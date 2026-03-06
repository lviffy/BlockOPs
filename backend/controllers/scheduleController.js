/**
 * Schedule Controller — One-time and recurring on-chain transfers
 *
 * POST   /schedule/transfer        — create a scheduled transfer
 * GET    /schedule                 — list all scheduled transfers for the agent
 * GET    /schedule/:id             — get a single scheduled transfer
 * DELETE /schedule/:id             — cancel (delete) a scheduled transfer
 * POST   /schedule/:id/pause       — pause a recurring job
 * POST   /schedule/:id/resume      — resume a paused recurring job
 *
 * Storage: Supabase `scheduled_transfers` table (see schema in database/schema.sql)
 * Engine:  node-cron (in-process). Jobs are reloaded from DB on server start.
 *
 * Body params for POST /schedule/transfer:
 *   privateKey       — server-side signer key
 *   toAddress        — recipient address
 *   amount           — human-readable ETH amount (e.g. "0.01")
 *   tokenAddress     — optional ERC20 address; omit for native ETH
 *   cronExpression   — standard 5-field cron (e.g. "0 9 * * 1" = every Monday 9am UTC)
 *                      OR ISO-8601 datetime string for a one-shot run
 *   label            — optional human-readable name for the job
 */

const cron     = require('node-cron');
const { ethers } = require('ethers');
const { getProvider, getWallet } = require('../utils/blockchain');
const { successResponse, errorResponse, getTxExplorerUrl } = require('../utils/helpers');
const { fireEvent } = require('../services/webhookService');
const supabase = require('../config/supabase');

// In-memory map of live cron tasks: jobId → cron.ScheduledTask
const activeTasks = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isOneShot(expr) {
  // If the expression looks like an ISO datetime, treat as one-shot
  return /^\d{4}-\d{2}-\d{2}/.test(expr);
}

function isValidCron(expr) {
  return cron.validate(expr);
}

/**
 * Execute the actual transfer for a scheduled job.
 * Writes outcome back to Supabase.
 */
async function runTransfer(job) {
  const { id, private_key, to_address, amount, token_address } = job;
  const provider = getProvider();
  const wallet   = getWallet(private_key, provider);

  let txHash = null;
  let error  = null;

  try {
    if (!token_address) {
      // Native ETH transfer
      const amountWei = ethers.parseEther(String(amount));
      const tx = await wallet.sendTransaction({ to: to_address, value: amountWei });
      await tx.wait();
      txHash = tx.hash;
    } else {
      // ERC20 transfer
      const ERC20_ABI = [
        'function decimals() view returns (uint8)',
        'function transfer(address to, uint256 amount) returns (bool)'
      ];
      const token    = new ethers.Contract(token_address, ERC20_ABI, wallet);
      const decimals = await token.decimals().catch(() => 18);
      const amountWei = ethers.parseUnits(String(amount), decimals);
      const tx = await token.transfer(to_address, amountWei);
      await tx.wait();
      txHash = tx.hash;
    }

    console.log(`[Schedule] Job ${id} executed successfully. Tx: ${txHash}`);

    // Fire webhook
    await fireEvent('tx.sent', job.agent_id || null, {
      type:      'scheduled_transfer',
      jobId:     id,
      txHash,
      from:      wallet.address,
      to:        to_address,
      amount,
      token:     token_address || 'ETH'
    }).catch(() => {});
  } catch (err) {
    error = err.shortMessage || err.message;
    console.error(`[Schedule] Job ${id} failed:`, error);
  }

  // Persist execution result
  if (supabase) {
    const logEntry = {
      ran_at:   new Date().toISOString(),
      tx_hash:  txHash,
      error:    error,
      success:  !error
    };
    const updatePayload = {
      last_run_at:    new Date().toISOString(),
      last_tx_hash:   txHash,
      last_error:     error,
      run_count:      (job.run_count || 0) + 1
    };
    await supabase
      .from('scheduled_transfers')
      .update(updatePayload)
      .eq('id', id)
      .catch(() => {});

    await supabase
      .from('scheduled_transfer_logs')
      .insert({ job_id: id, ...logEntry })
      .catch(() => {});
  }
}

/**
 * Register a cron task (or one-shot timer) in memory for a job row.
 */
function registerTask(job) {
  if (activeTasks.has(job.id)) {
    activeTasks.get(job.id).stop();
    activeTasks.delete(job.id);
  }

  if (job.status !== 'active') return;

  if (isOneShot(job.cron_expression)) {
    // One-shot: use setTimeout until the target datetime
    const target = new Date(job.cron_expression).getTime();
    const delay  = target - Date.now();
    if (delay <= 0) {
      console.warn(`[Schedule] One-shot job ${job.id} target is in the past — skipping.`);
      return;
    }
    const timer = setTimeout(async () => {
      await runTransfer(job);
      // Mark as completed after running once
      if (supabase) {
        await supabase
          .from('scheduled_transfers')
          .update({ status: 'completed' })
          .eq('id', job.id)
          .catch(() => {});
      }
      activeTasks.delete(job.id);
    }, delay);
    // Wrap timer in a task-like object so we can stop it
    activeTasks.set(job.id, { stop: () => clearTimeout(timer) });
  } else {
    // Recurring cron
    if (!isValidCron(job.cron_expression)) {
      console.warn(`[Schedule] Invalid cron expression for job ${job.id}: "${job.cron_expression}"`);
      return;
    }
    const task = cron.schedule(job.cron_expression, () => runTransfer(job), {
      timezone: 'UTC'
    });
    activeTasks.set(job.id, task);
  }

  console.log(`[Schedule] Registered job ${job.id} (${job.label || 'unlabeled'}) — "${job.cron_expression}"`);
}

/**
 * Load all active jobs from Supabase and re-register them.
 * Called once on server startup.
 */
async function reloadJobsFromDB() {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from('scheduled_transfers')
      .select('*')
      .eq('status', 'active');
    if (error) throw error;
    (data || []).forEach(registerTask);
    console.log(`[Schedule] Restored ${(data || []).length} active scheduled job(s) from DB.`);
  } catch (err) {
    console.error('[Schedule] Failed to reload jobs from DB:', err.message);
  }
}

// ── POST /schedule/transfer ────────────────────────────────────────────────────
async function createSchedule(req, res) {
  try {
    const {
      privateKey,
      toAddress,
      amount,
      tokenAddress,
      cronExpression,
      label
    } = req.body;

    if (!privateKey)      return res.status(400).json(errorResponse('privateKey is required'));
    if (!toAddress)        return res.status(400).json(errorResponse('toAddress is required'));
    if (!amount)           return res.status(400).json(errorResponse('amount is required'));
    if (!cronExpression)   return res.status(400).json(errorResponse('cronExpression (cron string or ISO datetime) is required'));

    if (!ethers.isAddress(toAddress)) {
      return res.status(400).json(errorResponse('Invalid toAddress'));
    }

    const oneShot = isOneShot(cronExpression);
    if (!oneShot && !isValidCron(cronExpression)) {
      return res.status(400).json(errorResponse(
        `Invalid cronExpression "${cronExpression}". Use a 5-field cron string (e.g. "0 9 * * 1") or an ISO datetime string.`
      ));
    }

    const agentId = req.apiKey?.agentId || null;

    // Validate address
    const provider = getProvider();
    const wallet = getWallet(privateKey, provider);

    const jobRow = {
      agent_id:        agentId,
      private_key:     privateKey,  // stored encrypted at rest via Supabase encryption
      to_address:      toAddress,
      amount:          String(amount),
      token_address:   tokenAddress || null,
      cron_expression: cronExpression,
      label:           label || null,
      type:            oneShot ? 'one_shot' : 'recurring',
      status:          'active',
      wallet_address:  wallet.address,
      run_count:       0,
      created_at:      new Date().toISOString(),
      updated_at:      new Date().toISOString()
    };

    let jobId;

    if (supabase) {
      const { data, error } = await supabase
        .from('scheduled_transfers')
        .insert(jobRow)
        .select()
        .single();
      if (error) throw new Error(`DB insert failed: ${error.message}`);
      jobId = data.id;
      registerTask(data);
    } else {
      // No Supabase — run in-memory only
      jobId = `mem_${Date.now()}`;
      const memJob = { ...jobRow, id: jobId };
      registerTask(memJob);
    }

    return res.status(201).json(successResponse({
      id:              jobId,
      label:           label || null,
      type:            oneShot ? 'one_shot' : 'recurring',
      cronExpression,
      toAddress,
      amount:          `${amount} ${tokenAddress ? '(ERC20)' : 'ETH'}`,
      tokenAddress:    tokenAddress || null,
      walletAddress:   wallet.address,
      status:          'active',
      note:            oneShot
        ? `Will run once at ${new Date(cronExpression).toISOString()}`
        : `Will run on schedule: "${cronExpression}" (UTC)`
    }));
  } catch (error) {
    console.error('createSchedule error:', error);
    return res.status(500).json(errorResponse(error.message));
  }
}

// ── GET /schedule ─────────────────────────────────────────────────────────────
async function listSchedules(req, res) {
  try {
    if (!supabase) {
      // Return in-memory tasks
      const tasks = [];
      activeTasks.forEach((_, id) => tasks.push({ id, status: 'active', note: 'in-memory (no Supabase)' }));
      return res.json(successResponse({ jobs: tasks, total: tasks.length }));
    }

    const agentId = req.apiKey?.agentId || null;
    let query = supabase
      .from('scheduled_transfers')
      .select('id, label, type, cron_expression, to_address, amount, token_address, wallet_address, status, run_count, last_run_at, last_tx_hash, last_error, created_at')
      .order('created_at', { ascending: false });

    if (agentId) query = query.eq('agent_id', agentId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Annotate with live/paused state from in-memory map
    const jobs = (data || []).map(j => ({
      ...j,
      liveStatus: activeTasks.has(j.id) ? 'running' : (j.status === 'active' ? 'pending_reload' : j.status)
    }));

    return res.json(successResponse({ jobs, total: jobs.length }));
  } catch (error) {
    console.error('listSchedules error:', error);
    return res.status(500).json(errorResponse(error.message));
  }
}

// ── GET /schedule/:id ─────────────────────────────────────────────────────────
async function getSchedule(req, res) {
  try {
    const { id } = req.params;
    if (!supabase) return res.status(503).json(errorResponse('Supabase not configured'));

    const { data, error } = await supabase
      .from('scheduled_transfers')
      .select('*, scheduled_transfer_logs(ran_at, tx_hash, error, success) ORDER BY scheduled_transfer_logs.ran_at DESC LIMIT 10')
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json(errorResponse('Job not found'));

    return res.json(successResponse({
      ...data,
      private_key: '[redacted]',  // never expose key in response
      liveStatus: activeTasks.has(id) ? 'running' : data.status
    }));
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

// ── DELETE /schedule/:id ──────────────────────────────────────────────────────
async function cancelSchedule(req, res) {
  try {
    const { id } = req.params;

    // Stop in-memory task
    if (activeTasks.has(id)) {
      activeTasks.get(id).stop();
      activeTasks.delete(id);
    }

    if (supabase) {
      const { error } = await supabase
        .from('scheduled_transfers')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    return res.json(successResponse({ id, status: 'cancelled', message: 'Scheduled transfer cancelled.' }));
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

// ── POST /schedule/:id/pause ──────────────────────────────────────────────────
async function pauseSchedule(req, res) {
  try {
    const { id } = req.params;

    if (activeTasks.has(id)) {
      activeTasks.get(id).stop();
    }

    if (supabase) {
      await supabase
        .from('scheduled_transfers')
        .update({ status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', id)
        .catch(() => {});
    }

    return res.json(successResponse({ id, status: 'paused' }));
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

// ── POST /schedule/:id/resume ─────────────────────────────────────────────────
async function resumeSchedule(req, res) {
  try {
    const { id } = req.params;
    if (!supabase) return res.status(503).json(errorResponse('Supabase not configured'));

    const { data, error } = await supabase
      .from('scheduled_transfers')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return res.status(404).json(errorResponse('Job not found'));

    registerTask(data);

    return res.json(successResponse({ id, status: 'active', message: 'Job resumed.' }));
  } catch (error) {
    return res.status(500).json(errorResponse(error.message));
  }
}

module.exports = {
  createSchedule,
  listSchedules,
  getSchedule,
  cancelSchedule,
  pauseSchedule,
  resumeSchedule,
  reloadJobsFromDB
};

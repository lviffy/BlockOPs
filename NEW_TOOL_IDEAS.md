# BlockOps – Arbitrum Tool Additions

## Bridging & L2 Operations
- L1↔L2 bridge (ETH / ERC20), retryable tickets creation, status, and re-exec
- Message status/checkpoint fetch, failed-retry helper

## DEX & Liquidity
- Swap (router-agnostic) with slippage guard
- Limit/stop orders helper
- Add/remove liquidity; LP position health check
- TWAP/price impact sanity checks

## Approvals & Allowances
- ERC20 approve / permit (EIP-2612)
- Allowance checker and revoker

## Batch Operations
- Multi-send / airdrop
- Batch transfers via multicall
- Scheduled / recurring transfers

## Gas & Fees
- Gas/fee quote; priority fee suggester
- Calldata size estimator; slippage guard helper

## Portfolio & Analytics
- Wallet portfolio breakdown
- Token/NFT holdings; historical PnL
- Realized/unrealized gain/loss

## Price & Market Data
- Historical price (OHLCV)
- Volatility bands
- Oracle vs DEX price sanity check

## NFTs
- Batch mint
- Safe transfer helper
- Metadata refresh/pin; royalty info fetch
- Floor/volume stats

## DeFi Safety
- Allowlist/blocklist checker
- Contract risk flags; spender risk check pre-approval
- Simulation (tenderly/anteroom) before send

## Governance / DAO
- Proposal creation
- Vote / delegate / undelegate
- Snapshot fetch

## Yield
- Deposit/withdraw to vault/LP
- Auto-compound helper
- APY fetch; reward claim
- Position health monitor

## Perps / Margin
- Open/close position
- Set TP/SL
- Funding rate fetch; liquidation price calculator

## Compliance & Hygiene
- ENS / ARBID resolve + reverse
- Address validation/checksum
- Spam token filter

## Dev / Ops
- Event/log fetch; block/txn lookup
- Trace / call simulation
- ABI fetch; decode calldata/logs

## Notifications
- Alerts (webhook/email/Telegram) for balance change, tx mined/fail, price threshold, liquidation risk

## Identity & Keys
- Session-based signer (no raw key)
- EIP-712 typed data signer
- Message signer/verify

## UX Helpers
- Retry with backoff
- Revert reason decoder
- Human-readable error explainer

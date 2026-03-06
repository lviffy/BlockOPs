const express = require('express');
const router  = express.Router();
const {
  createSchedule,
  listSchedules,
  getSchedule,
  cancelSchedule,
  pauseSchedule,
  resumeSchedule
} = require('../controllers/scheduleController');

// POST   /schedule/transfer    — create a new scheduled transfer
router.post('/transfer', createSchedule);

// GET    /schedule             — list all scheduled transfers
router.get('/', listSchedules);

// GET    /schedule/:id         — get a single job
router.get('/:id', getSchedule);

// DELETE /schedule/:id         — cancel a job
router.delete('/:id', cancelSchedule);

// POST   /schedule/:id/pause   — pause a recurring job
router.post('/:id/pause', pauseSchedule);

// POST   /schedule/:id/resume  — resume a paused job
router.post('/:id/resume', resumeSchedule);

module.exports = router;

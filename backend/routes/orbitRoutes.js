const express = require('express');
const router = express.Router();
const orbitController = require('../controllers/orbitController');

/**
 * Orbit L3 Configuration Routes
 * Base path: /api/orbit
 */

// Configuration Management
router.post('/config', orbitController.createConfig);
router.get('/config/:id', orbitController.getConfig);
router.get('/configs', orbitController.listConfigs);
router.put('/config/:id', orbitController.updateConfig);
router.delete('/config/:id', orbitController.deleteConfig);
router.post('/config/:id/validate', orbitController.validateConfig);

// Deployment Management
router.post('/deploy', orbitController.deployChain);
router.get('/deploy/status/:id', orbitController.getDeploymentStatus);

module.exports = router;

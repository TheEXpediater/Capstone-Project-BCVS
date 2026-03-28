const express = require('express');
const controller = require('./setting.controller');

// Adjust this import to your real auth middleware path.
const { protect, allowRoles } = require('../../shared/middleware/auth.middleware');

const router = express.Router();

router.get('/dashboard', protect, allowRoles('super_admin', 'developer'), controller.getDashboard);
router.put('/', protect, allowRoles('super_admin'), controller.updateSettings);
router.put('/admin-permissions/:userId', protect, allowRoles('super_admin'), controller.updateAdminPermissions);

module.exports = router;

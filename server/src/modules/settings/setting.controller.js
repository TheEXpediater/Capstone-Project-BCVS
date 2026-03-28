const settingService = require('./setting.service');

async function getDashboard(req, res, next) {
  try {
    const data = await settingService.getDashboard(req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function updateSettings(req, res, next) {
  try {
    const data = await settingService.updateSettings(req.body, req.user);
    res.status(200).json({ success: true, data, message: 'System settings updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function updateAdminPermissions(req, res, next) {
  try {
    const data = await settingService.updateAdminPermissions(req.params.userId, req.body.permissions || {}, req.user);
    res.status(200).json({ success: true, data, message: 'Admin permissions updated successfully.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboard,
  updateSettings,
  updateAdminPermissions,
};

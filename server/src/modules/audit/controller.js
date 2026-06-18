import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as auditService from './service.js';

export const listAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditService.listAuditLogs(req.query || {});
  res.status(200).json({ success: true, data });
});

export const getAuditLog = asyncHandler(async (req, res) => {
  const data = await auditService.getAuditLogById(req.params.id);
  res.status(200).json({ success: true, data });
});

export const deleteAuditLog = asyncHandler(async (req, res) => {
  const data = await auditService.deleteAuditLogById(req.params.id);
  res.status(200).json({
    success: true,
    data,
    message: 'Audit log deleted successfully.',
  });
});

export const bulkDeleteAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditService.bulkDeleteAuditLogs(req.body?.ids || []);
  res.status(200).json({
    success: true,
    data,
    message: 'Selected audit logs deleted successfully.',
  });
});
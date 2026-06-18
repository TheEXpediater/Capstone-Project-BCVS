import express from 'express';
import {
  bulkDeleteAuditLogs,
  deleteAuditLog,
  getAuditLog,
  listAuditLogs,
} from './controller.js';
import { allowRoles, protect } from '../../shared/middleware/auth.middleware.js';

const router = express.Router();

router.use(protect({ kind: 'web' }));
router.use(allowRoles('developer', 'super_admin'));

router.get('/', listAuditLogs);
router.get('/:id', getAuditLog);
router.delete('/:id', deleteAuditLog);
router.post('/bulk-delete', bulkDeleteAuditLogs);

export default router;
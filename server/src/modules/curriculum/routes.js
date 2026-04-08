import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  deleteCurriculum,
  getCurriculum,
  listCurricula,
  saveCurriculum,
} from './controller.js';

const router = express.Router();

router.get('/', protect({ kind: 'web' }), allowRoles('admin', 'super_admin', 'developer'), listCurricula);
router.get('/:id', protect({ kind: 'web' }), allowRoles('admin', 'super_admin', 'developer'), getCurriculum);
router.post('/', protect({ kind: 'web' }), allowRoles('admin', 'super_admin', 'developer'), saveCurriculum);
router.delete('/:id', protect({ kind: 'web' }), allowRoles('admin', 'super_admin', 'developer'), deleteCurriculum);

export default router;

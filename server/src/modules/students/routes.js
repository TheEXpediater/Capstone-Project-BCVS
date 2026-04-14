import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  getStudentById,
  getStudentGrades,
  importStudentGrades,
  importStudents,
  listStudents,
} from './controller.js';

const router = express.Router();

// Main Registrar (currently super_admin in your seed) + MIS developer
router.post(
  '/import',
  protect({ kind: 'web' }),
  allowRoles('super_admin', 'developer'),
  importStudents
);

router.post(
  '/import-grades',
  protect({ kind: 'web' }),
  allowRoles('super_admin', 'developer'),
  importStudentGrades
);

router.get(
  '/',
  protect({ kind: 'web' }),
  allowRoles('super_admin', 'developer'),
  listStudents
);

router.get(
  '/:id/grades',
  protect({ kind: 'web' }),
  allowRoles('super_admin', 'developer'),
  getStudentGrades
);

router.get(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('super_admin', 'developer'),
  getStudentById
);

export default router;
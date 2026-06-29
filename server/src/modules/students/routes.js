import express from 'express';
import { protect, allowRoles } from '../../shared/middleware/auth.middleware.js';
import {
  bulkDeleteStudents,
  createStudent,
  deleteStudentById,
  getStudentById,
  getStudentGrades,
  importStudentGrades,
  importStudents,
  listStudents,
  searchStudents,
  updateStudentById,
} from './controller.js';

const router = express.Router();

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

router.post(
  '/bulk-delete',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  bulkDeleteStudents
);

router.get(
  '/',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  listStudents
);

router.post(
  '/',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  createStudent
);

router.get(
  '/search',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  searchStudents
);

router.get(
  '/:id/grades',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getStudentGrades
);

router.put(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  updateStudentById
);

router.delete(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  deleteStudentById
);

router.get(
  '/:id',
  protect({ kind: 'web' }),
  allowRoles('admin', 'super_admin', 'developer'),
  getStudentById
);

export default router;

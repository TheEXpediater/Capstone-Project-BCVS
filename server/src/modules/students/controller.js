import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as studentService from './service.js';

function extractRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.rows)) return body.rows;
  return [];
}

export const listStudents = asyncHandler(async (_req, res) => {
  const data = await studentService.listStudents();
  res.status(200).json({ success: true, data });
});

export const getStudentById = asyncHandler(async (req, res) => {
  const data = await studentService.getStudentById(req.params.id);
  res.status(200).json({ success: true, data });
});

export const getStudentGrades = asyncHandler(async (req, res) => {
  const data = await studentService.getStudentGrades(req.params.id);
  res.status(200).json({ success: true, data });
});

export const importStudents = asyncHandler(async (req, res) => {
  const rows = extractRows(req.body);
  const data = await studentService.importStudents(rows, req.user);

  res.status(200).json({
    success: true,
    data,
    message: 'Student data imported successfully.',
  });
});

export const importStudentGrades = asyncHandler(async (req, res) => {
  const rows = extractRows(req.body);
  const data = await studentService.importStudentGrades(rows, req.user);

  res.status(200).json({
    success: true,
    data,
    message: 'Student grades imported successfully.',
  });
});
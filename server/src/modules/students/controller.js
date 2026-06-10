import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as studentService from './service.js';

function extractRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.rows)) return body.rows;
  return [];
}

export const listStudents = asyncHandler(async (req, res) => {
  const data = await studentService.listStudents(req.query || {});
  res.status(200).json({ success: true, data });
});

export const searchStudents = asyncHandler(async (req, res) => {
  const data = await studentService.searchStudents(req.query?.query || '');
  res.status(200).json({ success: true, data });
});

export const createStudent = asyncHandler(async (req, res) => {
  const data = await studentService.createStudent(req.body || {}, req.user);

  res.status(201).json({
    success: true,
    data,
    message: 'Student record created successfully.',
  });
});

export const getStudentById = asyncHandler(async (req, res) => {
  const data = await studentService.getStudentById(req.params.id);
  res.status(200).json({ success: true, data });
});

export const updateStudentById = asyncHandler(async (req, res) => {
  const data = await studentService.updateStudentById(
    req.params.id,
    req.body || {},
    req.user
  );

  res.status(200).json({
    success: true,
    data,
    message: 'Student profile updated successfully.',
  });
});

export const deleteStudentById = asyncHandler(async (req, res) => {
  const data = await studentService.deleteStudentById(req.params.id);

  res.status(200).json({
    success: true,
    data,
    message: 'Student record deleted successfully.',
  });
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

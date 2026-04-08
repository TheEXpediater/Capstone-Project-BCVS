import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as curriculumService from './service.js';

export const listCurricula = asyncHandler(async (_req, res) => {
  const data = await curriculumService.listCurricula();
  res.status(200).json({ success: true, data });
});

export const getCurriculum = asyncHandler(async (req, res) => {
  const data = await curriculumService.getCurriculumById(req.params.id);
  res.status(200).json({ success: true, data });
});

export const saveCurriculum = asyncHandler(async (req, res) => {
  const data = await curriculumService.saveCurriculum(req.body, req.user);
  res.status(200).json({
    success: true,
    data,
    message: 'Curriculum saved successfully.',
  });
});

export const deleteCurriculum = asyncHandler(async (req, res) => {
  const data = await curriculumService.deleteCurriculum(req.params.id);
  res.status(200).json({
    success: true,
    data,
    message: 'Curriculum deleted successfully.',
  });
});

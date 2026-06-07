import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import * as dashboardService from './service.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary(req.user);

  res.status(200).json({
    success: true,
    data,
  });
});

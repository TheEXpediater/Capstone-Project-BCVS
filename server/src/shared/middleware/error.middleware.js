import { ApiError } from '../utils/ApiError.js';

export function notFoundHandler(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(err, _req, res, _next) {
  const statusCode = err instanceof ApiError ? err.statusCode : err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    details: err instanceof ApiError ? err.details : null,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}

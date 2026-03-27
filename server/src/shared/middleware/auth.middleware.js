import { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { getSessionModel } from '../../modules/auth/session.model.js';
import { getUserModel } from '../../modules/auth/user.model.js';

export function protect(options = {}) {
  return async (req, _res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        throw new ApiError(401, 'Authorization token is missing');
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const payload = verifyAccessToken(token);

      if (!payload?.sub || !payload?.sid) {
        throw new ApiError(401, 'Invalid authorization token');
      }

      if (!Types.ObjectId.isValid(payload.sub) || !Types.ObjectId.isValid(payload.sid)) {
        throw new ApiError(401, 'Invalid authorization token');
      }

      const Session = getSessionModel();
      const User = getUserModel();

      const [session, user] = await Promise.all([
        Session.findById(payload.sid),
        User.findById(payload.sub),
      ]);

      if (!session || !session.isActive) {
        throw new ApiError(401, 'Session is no longer active');
      }

      if (session.expiresAt.getTime() < Date.now()) {
        throw new ApiError(401, 'Session has expired');
      }

      if (!user || !user.isActive) {
        throw new ApiError(401, 'User is not active');
      }

      if (options.kind && user.kind !== options.kind) {
        throw new ApiError(403, `This route is only for ${options.kind} users`);
      }

      req.user = user;
      req.auth = {
        token,
        sessionId: session._id.toString(),
        role: user.role,
        kind: user.kind,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function allowRoles(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'You do not have permission to access this route'));
    }

    next();
  };
}

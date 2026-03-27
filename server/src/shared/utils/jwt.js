import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { isTokenCurrent } from '../services/rules/adminRules';

export interface AuthUser { id: string; role: Role; email: string; name: string }
declare global { namespace Express { interface Request { user?: AuthUser } } }

function extractToken(req: Request) {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
}

/** Verifies a JWT and loads the user. Returns null for any bad/expired/unknown/blocked token. */
export async function resolveUserFromToken(token: string | undefined): Promise<{ user?: AuthUser; error?: AppError }> {
  if (!token) return { error: new AppError(401, 'Authentication required') };
  let sub: string;
  let tv: number | undefined;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as { sub?: string; tv?: number };
    if (!payload.sub) throw new Error('no sub');
    sub = payload.sub;
    tv = payload.tv;
  } catch {
    return { error: new AppError(401, 'Invalid or expired token') };
  }
  // Re-read the user so role changes and blocks take effect immediately.
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user) return { error: new AppError(401, 'User no longer exists') };
  if (user.isBlocked) return { error: new AppError(403, 'Your account has been blocked') };
  // A password change/reset or "log out everywhere" bumps tokenVersion, which retires every older token.
  if (!isTokenCurrent(tv, user.tokenVersion)) return { error: new AppError(401, 'Your session has ended. Please log in again.') };
  return { user: { id: user.id, role: user.role, email: user.email, name: user.name } };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const { user, error } = await resolveUserFromToken(extractToken(req));
    if (error) return next(error);
    req.user = user;
    next();
  } catch (e) {
    next(e); // genuine failures (e.g. database down) stay 5xx instead of being reported as 401
  }
}

/**
 * Attaches req.user when a valid token is present. Missing, invalid or blocked tokens simply
 * leave the request anonymous, so public endpoints never fail because of a stale token.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const { user } = await resolveUserFromToken(token);
    if (user) req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Authentication required'));
    if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission for this action'));
    next();
  };

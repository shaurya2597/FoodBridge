import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { asyncHandler } from '../utils/asyncHandler';
import * as account from '../services/accountService';

export const sign = (id: string, tokenVersion = 0) =>
  jwt.sign({ sub: id, tv: tokenVersion }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

export const publicUser = (u: { id: string; name: string; email: string; phone: string | null; role: string }) =>
  ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, phone, password, role, ngo } = req.body;
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError(409, 'Email is already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name, email, phone, passwordHash, role,
      ...(role === 'NGO' && ngo && {
        ngoProfile: { create: { ...ngo, contactEmail: email } },
      }),
    },
  });
  res.status(201).json({ success: true, data: { token: sign(user.id, user.tokenVersion), user: publicUser(user) } });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  // Same message for unknown email and wrong password to avoid account enumeration.
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Invalid email or password');
  if (user.isBlocked) throw new AppError(403, 'Your account has been blocked');
  res.json({ success: true, data: { token: sign(user.id, user.tokenVersion), user: publicUser(user) } });
});

// JWTs are stateless: the client discards the token. Endpoint exists for a consistent API.
export const logout = (_req: Request, res: Response) => res.json({ success: true, message: 'Logged out' });

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id }, include: { ngoProfile: true, addresses: true },
  });
  res.json({ success: true, data: { ...publicUser(user), ngoProfile: user.ngoProfile, addresses: user.addresses } });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, ...(await account.requestPasswordReset(req.body.email)) }));

export const resetPassword = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, ...(await account.resetPassword(req.body.token, req.body.password)) }));

/** Returns a fresh token because changing the password retires every older one, including this session's. */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await account.changePassword(req.user!, req.body.currentPassword, req.body.newPassword);
  res.json({ success: true, message: 'Password changed. Other devices have been signed out.', data: { token: sign(user.id, user.tokenVersion) } });
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await account.logoutEverywhere(req.user!);
  res.json({ success: true, message: 'Signed out on all devices. Log in again to continue.' });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) =>
  res.json({ success: true, data: publicUser(await account.updateProfile(req.user!, req.body)) }));

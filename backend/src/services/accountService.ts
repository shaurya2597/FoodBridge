import bcrypt from 'bcryptjs';
import { clientOrigins, env } from '../config/env';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../middleware/auth';
import { disconnectUser } from '../sockets';
import { generateResetToken, hashResetToken, isResetExpired } from './rules/resetToken';
import { sendPasswordResetEmail } from './mailer';

const GENERIC = 'If that email is registered, a password reset link has been sent.';

/** Always answers the same way, so the endpoint cannot be used to discover which emails have accounts. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  let demoToken: string | undefined;
  if (user && !user.isBlocked) {
    const { token, hash, expiresAt } = generateResetToken();
    await prisma.user.update({ where: { id: user.id }, data: { resetToken: hash, resetExpires: expiresAt } }); // a new request replaces the old token
    const link = `${clientOrigins[0] ?? 'http://localhost:5173'}/reset-password?token=${token}`;
    void sendPasswordResetEmail(user.email, link); // not awaited: response time must not reveal whether the account exists
    if (env.DEMO_RETURN_RESET_TOKEN) demoToken = token;
  }
  return { message: GENERIC, ...(demoToken && { demoResetToken: demoToken }) };
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { resetToken: hashResetToken(token) } });
  const now = new Date();
  if (!user || isResetExpired(user.resetExpires, now)) throw new AppError(400, 'This reset link is invalid or has expired');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  // The token is single-use: clearing it and changing the password happen in one update, guarded by the same hash.
  const done = await prisma.user.updateMany({
    where: { id: user.id, resetToken: user.resetToken },
    data: { passwordHash, resetToken: null, resetExpires: null, tokenVersion: { increment: 1 } },
  });
  if (done.count !== 1) throw new AppError(400, 'This reset link is invalid or has expired');
  disconnectUser(user.id); // end live sockets: every old session is now invalid
  return { message: 'Your password has been reset. Please log in with the new password.' };
}

export async function changePassword(user: AuthUser, currentPassword: string, newPassword: string) {
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(currentPassword, row.passwordHash))) throw new AppError(400, 'Your current password is incorrect');
  if (currentPassword === newPassword) throw new AppError(400, 'Choose a password different from the current one');
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), tokenVersion: { increment: 1 }, resetToken: null, resetExpires: null },
  });
  disconnectUser(user.id);
  return updated; // the controller issues a fresh token so THIS session continues
}

export async function logoutEverywhere(user: AuthUser) {
  await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  disconnectUser(user.id);
}

export async function updateProfile(user: AuthUser, patch: { name?: string; phone?: string | null }) {
  return prisma.user.update({ where: { id: user.id }, data: patch });
}

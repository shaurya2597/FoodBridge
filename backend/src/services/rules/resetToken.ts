import { createHash, randomBytes } from 'node:crypto';

export const RESET_TOKEN_TTL_MINUTES = 30;

export const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** The raw token goes in the email link. Only its hash is stored, so a database leak cannot be used to reset passwords. */
export function generateResetToken(now = new Date()) {
  const token = randomBytes(32).toString('hex');
  return { token, hash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000) };
}

export const isResetExpired = (expiresAt: Date | null | undefined, now: Date) => !expiresAt || expiresAt.getTime() <= now.getTime();

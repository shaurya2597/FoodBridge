import { z } from 'zod';

/** Positive integers only; limit capped at 50. Query values arrive as strings, hence coerce. */
export const paginationQuery = {
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(50).default(12),
};

/** http(s) only: z.string().url() alone would accept javascript: and data: URLs. */
export const httpUrl = z.string().trim().max(2048).url().refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL');

/** Money with at most 2 decimal places. */
export const money = (max: number) =>
  z.number().positive().max(max).refine((v) => Math.round(v * 100) / 100 === v, 'Max 2 decimal places');

/** bcrypt only uses the first 72 BYTES of a password; longer input is silently truncated. */
export const BCRYPT_MAX_BYTES = 72;
export const withinBcryptLimit = (v: string) => Buffer.byteLength(v, 'utf8') <= BCRYPT_MAX_BYTES;
export const BCRYPT_LIMIT_MESSAGE = 'Password is too long (max 72 bytes; non-English characters and emoji use more than one byte each)';

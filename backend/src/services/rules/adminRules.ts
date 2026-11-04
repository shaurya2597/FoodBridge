export type BlockCheck = { ok: true } | { ok: false; httpStatus: 400 | 403; message: string };

/** Admins cannot lock themselves out, and cannot block each other (that needs direct database access). */
export function checkBlockTarget(admin: { id: string }, target: { id: string; role: string }, blocked: boolean): BlockCheck {
  if (target.id === admin.id) return { ok: false, httpStatus: 400, message: 'You cannot block or unblock your own account' };
  if (target.role === 'ADMIN' && blocked) return { ok: false, httpStatus: 403, message: 'Administrator accounts cannot be blocked from here' };
  return { ok: true };
}

/** Tokens issued before tokenVersion existed carry no `tv` claim; they count as version 0. */
export const isTokenCurrent = (tokenTv: number | undefined, userTv: number) => (tokenTv ?? 0) === userTv;

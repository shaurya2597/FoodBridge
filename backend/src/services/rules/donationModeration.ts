import type { DonationStatus } from './donationStateMachine';

/** Admin can flag unsafe donations in any of these states. Distributed, cancelled, expired and already-flagged ones cannot be flagged. */
export const FLAGGABLE: DonationStatus[] = ['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED'];

export type FlagCheck = { ok: true } | { ok: false; httpStatus: 400 | 409; message: string };

export function checkFlag(from: DonationStatus, reason?: string): FlagCheck {
  if (from === 'FLAGGED') return { ok: false, httpStatus: 409, message: 'This donation is already flagged' };
  if (!FLAGGABLE.includes(from)) return { ok: false, httpStatus: 409, message: `A ${from.toLowerCase().replace(/_/g, ' ')} donation cannot be flagged` };
  if (!reason || reason.trim().length < 3) return { ok: false, httpStatus: 400, message: 'A reason is required to flag a donation' };
  return { ok: true };
}

interface HistoryLike { status: string }

/**
 * What a donation becomes when an admin removes the flag.
 * - Flagged AFTER collection: back to COLLECTED (the food is already with the NGO; never re-offer it).
 * - Otherwise: back to the open pool (POSTED), or EXPIRED if it ran out of time while flagged.
 */
export function statusAfterUnflag(history: unknown, expiresAt: Date, now: Date): { status: DonationStatus; releaseNgo: boolean } {
  const entries = Array.isArray(history) ? (history as HistoryLike[]) : [];
  const flagIdx = entries.map((h) => h.status).lastIndexOf('FLAGGED');
  const previous = flagIdx > 0 ? entries[flagIdx - 1].status : 'POSTED';
  if (previous === 'COLLECTED') return { status: 'COLLECTED', releaseNgo: false };
  if (expiresAt.getTime() <= now.getTime()) return { status: 'EXPIRED', releaseNgo: true };
  return { status: 'POSTED', releaseNgo: true };
}

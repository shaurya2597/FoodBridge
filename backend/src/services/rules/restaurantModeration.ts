export type RestaurantStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

const ALLOWED: Record<RestaurantStatus, RestaurantStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED'],
  REJECTED: ['APPROVED'], // an admin may reconsider a rejection
};
const NEEDS_REASON: RestaurantStatus[] = ['REJECTED', 'SUSPENDED'];

export type ModerationCheck = { ok: true } | { ok: false; httpStatus: 400 | 409; message: string };

export function checkRestaurantStatusChange(from: RestaurantStatus, to: RestaurantStatus, reason?: string): ModerationCheck {
  if (from === to) return { ok: false, httpStatus: 409, message: `Restaurant is already ${to.toLowerCase()}` };
  if (!ALLOWED[from].includes(to)) return { ok: false, httpStatus: 409, message: `A ${from.toLowerCase()} restaurant cannot become ${to.toLowerCase()}` };
  if (NEEDS_REASON.includes(to) && (!reason || reason.trim().length < 3))
    return { ok: false, httpStatus: 400, message: `A reason is required to mark a restaurant ${to.toLowerCase()}` };
  return { ok: true };
}

export type ComplaintStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
export const COMPLAINT_CATEGORIES = ['ORDER', 'DELIVERY', 'FOOD_QUALITY', 'PAYMENT', 'DONATION', 'OTHER'] as const;
export const PENDING_COMPLAINT_STATUSES: ComplaintStatus[] = ['OPEN', 'IN_REVIEW'];

const ALLOWED: Record<ComplaintStatus, ComplaintStatus[]> = {
  OPEN: ['IN_REVIEW', 'RESOLVED', 'REJECTED'],
  IN_REVIEW: ['RESOLVED', 'REJECTED'],
  RESOLVED: [],
  REJECTED: [],
};

export type ComplaintCheck = { ok: true } | { ok: false; httpStatus: 400 | 409; message: string };

export function checkComplaintTransition(from: ComplaintStatus, to: ComplaintStatus, resolution?: string): ComplaintCheck {
  if (from === to) return { ok: false, httpStatus: 409, message: `Complaint is already ${to.toLowerCase().replace('_', ' ')}` };
  if (ALLOWED[from].length === 0) return { ok: false, httpStatus: 409, message: `This complaint is already ${from.toLowerCase()} and can no longer change` };
  if (!ALLOWED[from].includes(to)) return { ok: false, httpStatus: 409, message: `Invalid status change: ${from} cannot move to ${to}` };
  if ((to === 'RESOLVED' || to === 'REJECTED') && (!resolution || resolution.trim().length < 5))
    return { ok: false, httpStatus: 400, message: 'A resolution message (at least 5 characters) is required to close a complaint' };
  return { ok: true };
}

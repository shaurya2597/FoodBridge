export type DonationStatus =
  | 'POSTED' | 'NGO_REQUESTED' | 'ACCEPTED' | 'PICKUP_SCHEDULED' | 'COLLECTED' | 'DISTRIBUTED'
  | 'EXPIRED' | 'FLAGGED' | 'CANCELLED';
export type DonationActor = 'DONOR' | 'NGO';

export const ACTIVE_DONATION_STATUSES: DonationStatus[] = ['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'];
export const FINAL_DONATION_STATUSES: DonationStatus[] = ['DISTRIBUTED', 'EXPIRED', 'FLAGGED', 'CANCELLED'];

/**
 * The complete list of moves allowed through PATCH /donations/:id/status.
 * (POSTED -> NGO_REQUESTED is deliberately NOT here: it only happens through POST /donations/:id/request,
 *  which claims the donation atomically.)
 * `to: POSTED` means the donation goes back to the pool: the donor rejected the NGO, or the NGO withdrew.
 */
const RULES: { from: DonationStatus; to: DonationStatus; actor: DonationActor }[] = [
  { from: 'NGO_REQUESTED', to: 'ACCEPTED', actor: 'DONOR' },
  { from: 'NGO_REQUESTED', to: 'POSTED', actor: 'DONOR' },
  { from: 'NGO_REQUESTED', to: 'POSTED', actor: 'NGO' },
  { from: 'ACCEPTED', to: 'PICKUP_SCHEDULED', actor: 'NGO' },
  { from: 'ACCEPTED', to: 'POSTED', actor: 'NGO' },
  { from: 'PICKUP_SCHEDULED', to: 'COLLECTED', actor: 'NGO' },
  { from: 'PICKUP_SCHEDULED', to: 'POSTED', actor: 'NGO' },
  { from: 'COLLECTED', to: 'DISTRIBUTED', actor: 'NGO' },
  ...(['POSTED', 'NGO_REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED'] as DonationStatus[]).map((from) => ({ from, to: 'CANCELLED' as DonationStatus, actor: 'DONOR' as DonationActor })),
];

/** Moves that must happen while the food is still safe. Releasing/cancelling/recording distribution never needs that. */
const NEEDS_UNEXPIRED: DonationStatus[] = ['ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED'];

export type DonationTransitionCheck = { ok: true } | { ok: false; httpStatus: 400 | 403 | 409; message: string };

export function checkDonationTransition(args: {
  from: DonationStatus; to: DonationStatus; actor: DonationActor;
  now: Date; expiresAt: Date; pickupAt?: Date;
}): DonationTransitionCheck {
  const { from, to, actor, now, expiresAt, pickupAt } = args;
  const label = (s: string) => s.toLowerCase().replace(/_/g, ' ');

  if (FINAL_DONATION_STATUSES.includes(from)) return { ok: false, httpStatus: 409, message: `This donation is already ${label(from)}` };
  if (from === to) return { ok: false, httpStatus: 409, message: `This donation is already ${label(to)}` };

  const allowedForSomeone = RULES.filter((r) => r.from === from && r.to === to);
  if (allowedForSomeone.length === 0) {
    const hint = from === 'POSTED' && to === 'NGO_REQUESTED' ? ' NGOs must use the request endpoint.' : '';
    return { ok: false, httpStatus: 409, message: `Invalid status change: ${label(from)} cannot move to ${label(to)}.${hint}` };
  }
  if (!allowedForSomeone.some((r) => r.actor === actor)) {
    const who = allowedForSomeone.map((r) => (r.actor === 'DONOR' ? 'the donor' : 'the collecting NGO')).join(' or ');
    return { ok: false, httpStatus: 403, message: `Only ${who} can do this` };
  }
  if (NEEDS_UNEXPIRED.includes(to) && expiresAt.getTime() <= now.getTime())
    return { ok: false, httpStatus: 409, message: 'This donation has expired and is no longer safe to collect' };

  if (to === 'PICKUP_SCHEDULED') {
    if (!pickupAt) return { ok: false, httpStatus: 400, message: 'pickupAt is required to schedule a pickup' };
    if (pickupAt.getTime() <= now.getTime()) return { ok: false, httpStatus: 400, message: 'Pickup time must be in the future' };
    if (pickupAt.getTime() >= expiresAt.getTime()) return { ok: false, httpStatus: 400, message: 'Pickup must be scheduled before the food expires' };
  }
  return { ok: true };
}

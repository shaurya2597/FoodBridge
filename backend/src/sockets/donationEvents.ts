import { getIo } from './index';
import { ADMIN_DONATION_ROOM, NGO_ROOM } from './rooms';

export interface DonationEventPayload {
  donationId: string; foodName?: string; status: string; previousStatus?: string;
  pickupScheduledAt?: string | null; available?: boolean; at: string;
}

/** Sent after the database change has committed. Never contains addresses or phone numbers. */
export function emitDonationEvent(
  event: 'donation:posted' | 'donation:status' | 'donation:availability',
  payload: DonationEventPayload,
  audience: { userIds?: (string | null | undefined)[]; toNgos?: boolean },
) {
  const io = getIo();
  if (!io) return;
  const rooms = [ADMIN_DONATION_ROOM, ...(audience.userIds ?? []).filter((x): x is string => !!x).map((id) => `user:${id}`)];
  if (audience.toNgos) rooms.push(NGO_ROOM);
  io.to(rooms).emit(event, payload);
}

export function emitAssistanceEvent(
  event: 'assistance:new' | 'assistance:status',
  payload: { requestId: string; status: string; city?: string; at: string },
  audience: { userIds?: (string | null | undefined)[]; toNgos?: boolean },
) {
  const io = getIo();
  if (!io) return;
  const rooms = [ADMIN_DONATION_ROOM, ...(audience.userIds ?? []).filter((x): x is string => !!x).map((id) => `user:${id}`)];
  if (audience.toNgos) rooms.push(NGO_ROOM);
  io.to(rooms).emit(event, payload);
}

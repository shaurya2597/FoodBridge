import { getIo } from './index';

export interface OrderEventPayload {
  orderId: string;
  orderNumber: string;
  status: string;
  previousStatus?: string;
  paymentStatus?: string;
  reason?: string | null;
  estimatedAt?: string;
  at: string;
}

interface Audience { customerId: string; ownerId: string; orderId: string }

/**
 * Broadcast ONLY to authorised rooms: the customer's private room, the restaurant owner's private room,
 * the admin monitoring room, and the per-order room (which sockets can join only after an ownership check).
 * Call this AFTER the database transaction has committed so clients never see state that was rolled back.
 */
export function emitOrderEvent(event: 'order:placed' | 'order:status' | 'order:payment', payload: OrderEventPayload, a: Audience) {
  const io = getIo();
  if (!io) return;
  const rooms = [`user:${a.customerId}`, `user:${a.ownerId}`, 'admin:orders'];
  if (event !== 'order:placed') rooms.push(`order:${a.orderId}`);
  io.to(rooms).emit(event, payload); // one delivery per socket even if it is in several of these rooms
}

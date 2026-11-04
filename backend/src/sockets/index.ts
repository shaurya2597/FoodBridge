import { Server } from 'socket.io';
import http from 'http';
import { z } from 'zod';
import { clientOrigins } from '../config/env';
import { prisma } from '../config/prisma';
import { resolveUserFromToken } from '../middleware/auth';
import { canAccessOrder } from '../services/rules/orderAccess';
import { ADMIN_DONATION_ROOM, NGO_ROOM } from './rooms';

let io: Server | undefined;
export const getIo = () => io;

/** Called when an admin verifies or un-verifies an NGO, so its open sockets start/stop receiving donation alerts immediately. */
export function syncNgoRoom(userId: string, verified: boolean) {
  const target = io?.in(`user:${userId}`);
  if (verified) target?.socketsJoin(NGO_ROOM); else target?.socketsLeave(NGO_ROOM);
}

const MAX_ORDER_SUBSCRIPTIONS = 50;
const subscribeBody = z.object({ orderId: z.string().min(1).max(40) });
type Ack = (response: { ok: boolean; error?: string }) => void;

export function initSockets(server: http.Server) {
  io = new Server(server, { cors: { origin: clientOrigins } });

  // Same rules as HTTP auth: valid JWT, user still exists, user not blocked.
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token;
      const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '').trim() : undefined;
      const { user, error } = await resolveUserFromToken(token);
      if (error || !user) return next(new Error(error?.message ?? 'unauthorized'));
      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`); // private room for this user's order/donation updates
    if (socket.data.role === 'ADMIN') { socket.join('admin:orders'); socket.join(ADMIN_DONATION_ROOM); } // admins monitor everything
    if (socket.data.role === 'NGO') {
      // Only VERIFIED NGOs hear about newly available donations. Verification is checked at connect time,
      // so an NGO verified later receives them from its next connection.
      prisma.nGOProfile.findUnique({ where: { userId: socket.data.userId }, select: { isVerified: true } })
        .then((p) => { if (p?.isVerified) socket.join(NGO_ROOM); })
        .catch(() => undefined);
    }

    // Customers, owners and admins may follow a single order, but only after the server re-checks access.
    socket.on('order:subscribe', async (payload: unknown, ack?: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      try {
        const parsed = subscribeBody.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, error: 'Invalid orderId' });
        const joined = [...socket.rooms].filter((r) => r.startsWith('order:')).length;
        if (joined >= MAX_ORDER_SUBSCRIPTIONS) return reply({ ok: false, error: 'Too many order subscriptions' });

        const order = await prisma.order.findUnique({
          where: { id: parsed.data.orderId },
          select: { userId: true, restaurant: { select: { ownerId: true } } },
        });
        const allowed = order && canAccessOrder(
          { id: socket.data.userId, role: socket.data.role },
          { userId: order.userId, restaurantOwnerId: order.restaurant.ownerId },
        );
        // Same answer for "does not exist" and "not yours" so order ids cannot be probed.
        if (!allowed) return reply({ ok: false, error: 'Order not found' });
        await socket.join(`order:${parsed.data.orderId}`);
        reply({ ok: true });
      } catch {
        reply({ ok: false, error: 'Could not subscribe' });
      }
    });

    socket.on('order:unsubscribe', async (payload: unknown, ack?: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      const parsed = subscribeBody.safeParse(payload);
      if (!parsed.success) return reply({ ok: false, error: 'Invalid orderId' });
      await socket.leave(`order:${parsed.data.orderId}`);
      reply({ ok: true });
    });
  });
}

/** Push a realtime event to every open session of one user (used by Phase 2/3). */
export const emitToUser = (userId: string, event: string, payload: unknown) =>
  io?.to(`user:${userId}`).emit(event, payload);

/**
 * Drop live sockets immediately. Phase 4's block-user handler MUST call this right after setting
 * isBlocked = true, so a blocked user's existing Socket.IO sessions end at once.
 */
export const disconnectUser = (userId: string) => io?.in(`user:${userId}`).disconnectSockets(true);

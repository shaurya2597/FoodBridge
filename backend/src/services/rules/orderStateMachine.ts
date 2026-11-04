export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type OrderActor = 'CUSTOMER' | 'RESTAURANT_OWNER' | 'ADMIN';

export const ORDER_FLOW: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
export const TERMINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED'];
export const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

const NEXT: Record<OrderStatus, OrderStatus | null> = {
  PLACED: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED', DELIVERED: null, CANCELLED: null,
};

/** Statuses from which each actor may cancel. Nobody can cancel once the food is out for delivery. */
const CANCELLABLE_FROM: Record<OrderActor, OrderStatus[]> = {
  CUSTOMER: ['PLACED', 'ACCEPTED'],
  RESTAURANT_OWNER: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'],
  ADMIN: ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'],
};

export type TransitionCheck = { ok: true } | { ok: false; httpStatus: 403 | 409; message: string };

export function checkTransition(
  from: OrderStatus, to: OrderStatus, actor: OrderActor, ctx: { paymentOk: boolean },
): TransitionCheck {
  if (TERMINAL.includes(from)) return { ok: false, httpStatus: 409, message: `Order is already ${from.toLowerCase()}` };
  if (from === to) return { ok: false, httpStatus: 409, message: `Order is already ${to.toLowerCase().replace(/_/g, ' ')}` };

  if (to === 'CANCELLED') {
    if (!CANCELLABLE_FROM[actor].includes(from))
      return { ok: false, httpStatus: 409, message: `An order that is ${from.toLowerCase().replace(/_/g, ' ')} can no longer be cancelled` };
    return { ok: true };
  }
  if (actor === 'CUSTOMER') return { ok: false, httpStatus: 403, message: 'Customers can only cancel orders' };
  if (NEXT[from] !== to) {
    return { ok: false, httpStatus: 409, message: `Invalid status change: ${from} cannot move to ${to}. Next step is ${NEXT[from]}` };
  }
  if (from === 'PLACED' && !ctx.paymentOk) {
    return { ok: false, httpStatus: 409, message: 'Order cannot be accepted until payment is confirmed' };
  }
  return { ok: true };
}

export const isTerminal = (s: OrderStatus) => TERMINAL.includes(s);

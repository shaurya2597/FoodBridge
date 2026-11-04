import type { OrderActor } from './orderStateMachine';

export interface AccessUser { id: string; role: string }
export interface AccessOrder { userId: string; restaurantOwnerId: string }

/** Single source of truth for "may this user see/subscribe to this order?" (HTTP and Socket.IO). */
export function canAccessOrder(user: AccessUser, order: AccessOrder): boolean {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'CUSTOMER') return order.userId === user.id;
  if (user.role === 'RESTAURANT_OWNER') return order.restaurantOwnerId === user.id;
  return false;
}

export function actorForRole(role: string): OrderActor | null {
  return role === 'CUSTOMER' || role === 'RESTAURANT_OWNER' || role === 'ADMIN' ? role : null;
}

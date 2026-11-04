import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTransition, OrderStatus, ORDER_FLOW } from '../../src/services/rules/orderStateMachine';
import { canAccessOrder, actorForRole } from '../../src/services/rules/orderAccess';

const paid = { paymentOk: true };

describe('order status transitions', () => {
  test('owner can walk the whole happy path in order', () => {
    for (let i = 0; i < ORDER_FLOW.length - 1; i++) {
      assert.equal(checkTransition(ORDER_FLOW[i], ORDER_FLOW[i + 1], 'RESTAURANT_OWNER', paid).ok, true, `${ORDER_FLOW[i]} -> ${ORDER_FLOW[i + 1]}`);
    }
  });

  test('skipping a step is rejected', () => {
    const r = checkTransition('PLACED', 'PREPARING', 'RESTAURANT_OWNER', paid);
    assert.equal(r.ok, false);
    assert.equal((r as any).httpStatus, 409);
  });

  test('going backwards is rejected', () => assert.equal(checkTransition('PREPARING', 'ACCEPTED', 'ADMIN', paid).ok, false));

  test('every status change from a terminal state is rejected, for every actor', () => {
    const all: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    for (const from of ['DELIVERED', 'CANCELLED'] as OrderStatus[])
      for (const to of all) for (const actor of ['CUSTOMER', 'RESTAURANT_OWNER', 'ADMIN'] as const)
        assert.equal(checkTransition(from, to, actor, paid).ok, false, `${actor}: ${from} -> ${to}`);
  });

  test('customers can cancel only before preparation starts', () => {
    assert.equal(checkTransition('PLACED', 'CANCELLED', 'CUSTOMER', paid).ok, true);
    assert.equal(checkTransition('ACCEPTED', 'CANCELLED', 'CUSTOMER', paid).ok, true);
    for (const s of ['PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as OrderStatus[])
      assert.equal(checkTransition(s, 'CANCELLED', 'CUSTOMER', paid).ok, false, s);
  });

  test('customers cannot move an order forward', () => {
    const r = checkTransition('PLACED', 'ACCEPTED', 'CUSTOMER', paid);
    assert.equal(r.ok, false);
    assert.equal((r as any).httpStatus, 403);
  });

  test('owner can reject/cancel until ready, but not once out for delivery', () => {
    for (const s of ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'] as OrderStatus[])
      assert.equal(checkTransition(s, 'CANCELLED', 'RESTAURANT_OWNER', paid).ok, true, s);
    assert.equal(checkTransition('OUT_FOR_DELIVERY', 'CANCELLED', 'RESTAURANT_OWNER', paid).ok, false);
    assert.equal(checkTransition('OUT_FOR_DELIVERY', 'CANCELLED', 'ADMIN', paid).ok, false);
  });

  test('an order with unconfirmed online payment cannot be accepted', () => {
    const r = checkTransition('PLACED', 'ACCEPTED', 'RESTAURANT_OWNER', { paymentOk: false });
    assert.equal(r.ok, false);
    assert.match((r as any).message, /payment/i);
  });

  test('payment check does not block cancelling an unpaid order', () => {
    assert.equal(checkTransition('PLACED', 'CANCELLED', 'CUSTOMER', { paymentOk: false }).ok, true);
  });
});

describe('order access rules (shared by HTTP and Socket.IO)', () => {
  const order = { userId: 'cust-1', restaurantOwnerId: 'owner-1' };
  test('the customer who placed it', () => assert.equal(canAccessOrder({ id: 'cust-1', role: 'CUSTOMER' }, order), true));
  test('a different customer is denied', () => assert.equal(canAccessOrder({ id: 'cust-2', role: 'CUSTOMER' }, order), false));
  test('the restaurant owner', () => assert.equal(canAccessOrder({ id: 'owner-1', role: 'RESTAURANT_OWNER' }, order), true));
  test('another restaurant owner is denied', () => assert.equal(canAccessOrder({ id: 'owner-2', role: 'RESTAURANT_OWNER' }, order), false));
  test('admin can monitor any order', () => assert.equal(canAccessOrder({ id: 'admin-1', role: 'ADMIN' }, order), true));
  test('NGO users have no access', () => assert.equal(canAccessOrder({ id: 'ngo-1', role: 'NGO' }, order), false));
  test('a customer id equal to the owner id does not grant owner access', () =>
    assert.equal(canAccessOrder({ id: 'owner-1', role: 'CUSTOMER' }, order), false));
  test('role to actor mapping', () => {
    assert.equal(actorForRole('CUSTOMER'), 'CUSTOMER');
    assert.equal(actorForRole('NGO'), null);
  });
});

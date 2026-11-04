import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect, Socket } from 'socket.io-client';
import { Ctx, INTEGRATION_ENABLED, setup } from './fixtures';

// NOT executed in the authoring sandbox (no database, no socket.io-client installed). See README.
describe('Socket.IO access control and live order updates', { skip: !INTEGRATION_ENABLED && 'set TEST_DATABASE_URL to run integration tests' }, () => {
  let c: Ctx; let orderId: string; const open: Socket[] = [];

  const client = (token?: string) => {
    const s = connect(c.base, { auth: token ? { token } : {}, transports: ['websocket'], reconnection: false, forceNew: true });
    open.push(s);
    return s;
  };
  const connected = (s: Socket) => new Promise<void>((res, rej) => { s.once('connect', () => res()); s.once('connect_error', (e) => rej(e)); });
  const subscribe = (s: Socket, id: string) => new Promise<{ ok: boolean; error?: string }>((res) => s.emit('order:subscribe', { orderId: id }, res));
  const nextEvent = (s: Socket, ev: string, ms = 1500) =>
    new Promise<any>((res, rej) => { const t = setTimeout(() => rej(new Error(`no ${ev}`)), ms); s.once(ev, (p) => { clearTimeout(t); res(p); }); });
  const silent = (s: Socket, ev: string, ms = 600) =>
    new Promise<boolean>((res) => { let got = false; s.once(ev, () => { got = true; }); setTimeout(() => res(!got), ms); });

  before(async () => {
    c = await setup();
    await c.api('POST', '/cart/items', c.tokens.custA, { foodItemId: c.foods.main.id, quantity: 2 });
    orderId = (await c.api('POST', '/orders', c.tokens.custA, c.orderBody())).json.data.id;
  });
  after(async () => { open.forEach((s) => s.close()); await c?.cleanup(); });

  test('connections without a valid token are refused', async () => {
    await assert.rejects(connected(client()));
    await assert.rejects(connected(client('not.a.jwt')));
  });

  test('a blocked user cannot connect', async () => {
    await c.prisma.user.update({ where: { id: c.users.custB.id }, data: { isBlocked: true } });
    await assert.rejects(connected(client(c.tokens.custB)));
    await c.prisma.user.update({ where: { id: c.users.custB.id }, data: { isBlocked: false } });
  });

  test('only people with access may subscribe to an order', async () => {
    const [cust, other, owner, otherOwner, admin] = [c.tokens.custA, c.tokens.custB, c.tokens.owner1, c.tokens.owner2, c.tokens.admin].map(client);
    await Promise.all([cust, other, owner, otherOwner, admin].map(connected));
    assert.equal((await subscribe(cust, orderId)).ok, true);
    assert.equal((await subscribe(owner, orderId)).ok, true);
    assert.equal((await subscribe(admin, orderId)).ok, true);
    assert.equal((await subscribe(other, orderId)).ok, false);
    assert.equal((await subscribe(otherOwner, orderId)).ok, false);
    assert.equal((await subscribe(cust, 'no-such-order')).ok, false);
    assert.equal((await subscribe(cust, undefined as any)).ok, false);
  });

  test('status updates reach the customer, the owner and admins but not unrelated users', async () => {
    const cust = client(c.tokens.custA); const owner = client(c.tokens.owner1); const admin = client(c.tokens.admin);
    const stranger = client(c.tokens.custB); const otherOwner = client(c.tokens.owner2);
    await Promise.all([cust, owner, admin, stranger, otherOwner].map(connected));

    const got = [nextEvent(cust, 'order:status'), nextEvent(owner, 'order:status'), nextEvent(admin, 'order:status')];
    const quiet = [silent(stranger, 'order:status'), silent(otherOwner, 'order:status')];
    const r = await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status: 'ACCEPTED' });
    assert.equal(r.status, 200);

    for (const p of await Promise.all(got)) {
      assert.equal(p.orderId, orderId);
      assert.equal(p.status, 'ACCEPTED');
      assert.equal(p.previousStatus, 'PLACED');
    }
    assert.deepEqual(await Promise.all(quiet), [true, true]);
    // persisted before broadcast
    assert.equal((await c.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status, 'ACCEPTED');
  });

  test('a new order is announced to the restaurant owner', async () => {
    const owner = client(c.tokens.owner1); await connected(owner);
    const placed = nextEvent(owner, 'order:placed');
    await c.api('POST', '/cart/items', c.tokens.custB, { foodItemId: c.foods.main.id, quantity: 2 });
    const r = await c.api('POST', '/orders', c.tokens.custB, c.orderBody());
    const p = await placed;
    assert.equal(p.orderId, r.json.data.id);
  });
});

import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, INTEGRATION_ENABLED, PASSWORD, setup } from './fixtures';

// NOT executed in the authoring sandbox (no database there). Run with TEST_DATABASE_URL set; see README.
describe('Phase 4: admin, moderation, complaints and accounts', { skip: !INTEGRATION_ENABLED && 'set TEST_DATABASE_URL to run integration tests' }, () => {
  let c: Ctx;
  before(async () => { c = await setup(); });
  after(async () => { await c?.cleanup(); });

  const A = () => c.tokens.admin;
  const hours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();
  const placeDelivered = async (customerToken: string) => {
    await c.api('POST', '/cart/items', customerToken, { foodItemId: c.foods.main.id, quantity: 2 });
    const placed = await c.api('POST', '/orders', customerToken, c.orderBody());
    assert.equal(placed.status, 201, JSON.stringify(placed.json));
    for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'])
      assert.equal((await c.api('PATCH', `/orders/${placed.json.data.id}/status`, c.tokens.owner1, { status })).status, 200);
    return placed.json.data as { id: string; orderNumber: string; total: number };
  };
  const donate = async (token = c.tokens.custA) => {
    const r = await c.api('POST', '/donations', token, c.donationBody());
    assert.equal(r.status, 201, JSON.stringify(r.json));
    return r.json.data.id as string;
  };

  describe('access control', () => {
    const paths = ['/admin/dashboard', '/admin/analytics', '/admin/users', '/admin/restaurants', '/admin/orders', '/admin/ngos', '/admin/donations',
      '/admin/donation-requests', '/admin/complaints', '/admin/audit-logs'];
    test('no token: 401 for every admin endpoint', async () => {
      for (const p of paths) assert.equal((await c.api('GET', p)).status, 401, p);
    });
    test('customers, owners and NGOs: 403 for every admin endpoint', async () => {
      for (const t of [c.tokens.custA, c.tokens.owner1, c.tokens.ngoA]) for (const p of paths) assert.equal((await c.api('GET', p, t)).status, 403, p);
      assert.equal((await c.api('PATCH', `/admin/users/${c.users.custA.id}/block`, c.tokens.owner1, { blocked: true, reason: 'nope nope' })).status, 403);
      assert.equal((await c.api('PATCH', `/admin/restaurants/${c.r1.id}/status`, c.tokens.owner1, { status: 'APPROVED' })).status, 403);
      assert.equal((await c.api('PATCH', `/admin/ngos/${c.ngos.C.id}/verification`, c.tokens.ngoC, { verified: true })).status, 403); // an NGO cannot verify itself
    });
    test('admins can read everything', async () => {
      for (const p of paths) assert.equal((await c.api('GET', p, A())).status, 200, p);
    });
  });

  describe('dashboard and analytics', () => {
    test('dashboard has the headline numbers', async () => {
      const d = (await c.api('GET', '/admin/dashboard', A())).json.data;
      assert.ok(d.users.total >= 8);
      assert.ok(d.users.byRole.ADMIN >= 2);
      for (const key of ['restaurants', 'orders', 'revenue', 'donations', 'complaints', 'ngos', 'assistance']) assert.ok(d[key], key);
      assert.equal(d.revenue.currency, 'INR');
    });
    test('revenue and charts reflect a delivered, paid order', async () => {
      const before = (await c.api('GET', '/admin/dashboard', A())).json.data;
      const order = await placeDelivered(c.tokens.custA);
      const after = (await c.api('GET', '/admin/dashboard', A())).json.data;
      assert.equal(Math.round((after.revenue.total - before.revenue.total) * 100) / 100, order.total);
      assert.equal(after.orders.total, before.orders.total + 1);

      const a = (await c.api('GET', '/admin/analytics?days=7', A())).json.data;
      assert.equal(a.ordersOverTime.length, 7);
      assert.ok(a.totals.orders >= 1 && a.totals.revenue >= order.total);
      assert.ok(a.popularRestaurants.some((r: any) => r.name === c.r1.name));
      assert.ok(a.topFoodItems.some((f: any) => f.name === 'Main' && f.quantitySold >= 2));
      assert.ok(a.activeUsers.count >= 1);
      assert.equal(a.ordersOverTime.at(-1).date, new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
    });
    test('days must be 7, 30 or 90', async () => {
      assert.equal((await c.api('GET', '/admin/analytics?days=30', A())).json.data.ordersOverTime.length, 30);
      assert.equal((await c.api('GET', '/admin/analytics?days=15', A())).status, 400);
      assert.equal((await c.api('GET', '/admin/analytics?days=abc', A())).status, 400);
    });
    test('donation statistics count servings that reached NGOs', async () => {
      const before = (await c.api('GET', '/admin/analytics', A())).json.data.donations.servingsSavedAllTime;
      const id = await donate();
      await c.api('POST', `/donations/${id}/request`, c.tokens.ngoA, {});
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.custA, { status: 'ACCEPTED' });
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.ngoA, { status: 'PICKUP_SCHEDULED', pickupAt: new Date(Date.now() + 3600_000).toISOString() });
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.ngoA, { status: 'COLLECTED' });
      const a = (await c.api('GET', '/admin/analytics', A())).json.data;
      assert.equal(a.donations.servingsSavedAllTime, before + 10);
    });
  });

  describe('user management', () => {
    test('listing, search and role filter never expose password data', async () => {
      const r = await c.api('GET', `/admin/users?q=${c.tag}&limit=50`, A());
      assert.equal(r.status, 200);
      assert.ok(r.json.data.length >= 8);
      assert.equal(JSON.stringify(r.json).includes('passwordHash'), false);
      assert.equal(JSON.stringify(r.json).includes('resetToken'), false);
      const ngos = (await c.api('GET', `/admin/users?q=${c.tag}&role=NGO&limit=50`, A())).json.data;
      assert.equal(ngos.length, 3);
      assert.ok(ngos.every((u: any) => u.role === 'NGO'));
      assert.equal((await c.api('GET', '/admin/users?limit=51', A())).status, 400);
      assert.equal((await c.api('GET', '/admin/users?role=KING', A())).status, 400);
    });
    test('blocking needs a reason, locks the user out immediately, and unblocking restores access', async () => {
      const u = await c.register('blockme');
      const id = u.id;
      assert.equal((await c.api('GET', '/auth/me', u.token)).status, 200);
      assert.equal((await c.api('PATCH', `/admin/users/${id}/block`, A(), { blocked: true })).status, 400);
      const b = await c.api('PATCH', `/admin/users/${id}/block`, A(), { blocked: true, reason: 'Fraudulent orders' });
      assert.equal(b.status, 200);
      assert.equal(b.json.data.isBlocked, true);
      assert.equal((await c.api('GET', '/auth/me', u.token)).status, 403); // the existing token stops working at once
      assert.equal((await c.api('POST', '/auth/login', undefined, { email: u.email, password: PASSWORD })).status, 403);
      const unblocked = await c.api('PATCH', `/admin/users/${id}/block`, A(), { blocked: false });
      assert.equal(unblocked.json.data.blockedReason, null);
      assert.equal((await c.api('GET', '/auth/me', u.token)).status, 200);
      const log = (await c.api('GET', `/admin/audit-logs?entityType=USER&limit=50`, A())).json.data.filter((l: any) => l.entityId === id);
      assert.deepEqual(log.map((l: any) => l.action).sort(), ['USER_BLOCKED', 'USER_UNBLOCKED']);
      assert.ok(log.every((l: any) => l.admin.id === c.users.admin.id));
    });
    test('admins cannot block themselves or each other; unknown users are 404', async () => {
      assert.equal((await c.api('PATCH', `/admin/users/${c.users.admin.id}/block`, A(), { blocked: true, reason: 'oops oops' })).status, 400);
      assert.equal((await c.api('PATCH', `/admin/users/${c.users.admin2.id}/block`, A(), { blocked: true, reason: 'coup attempt' })).status, 403);
      assert.equal((await c.api('PATCH', '/admin/users/nope/block', A(), { blocked: true, reason: 'who dis' })).status, 404);
    });
  });

  describe('restaurant approval', () => {
    let restaurantId: string;
    const body = (extra: object = {}) => ({ name: `${'x'}${Date.now()} Kitchen`, description: 'A new kitchen awaiting approval', cuisines: ['Test'], imageUrl: 'https://example.com/k.png', address: '5 New Road', city: 'Jodhpur', ...extra });
    test('an owner-registered restaurant starts PENDING and is invisible to the public', async () => {
      const r = await c.api('POST', '/restaurants', c.tokens.owner1, body());
      assert.equal(r.status, 201);
      restaurantId = r.json.data.id;
      assert.equal(r.json.data.status, 'PENDING');
      assert.equal((await c.api('GET', `/restaurants/${restaurantId}`)).status, 404);
      const pending = (await c.api('GET', '/admin/restaurants?status=PENDING&limit=50', A())).json.data;
      assert.ok(pending.some((x: any) => x.id === restaurantId));
    });
    test('rejecting needs a reason; the owner sees the reason', async () => {
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'REJECTED' })).status, 400);
      const r = await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'REJECTED', reason: 'Missing food licence' });
      assert.equal(r.status, 200);
      assert.equal((await c.api('GET', `/restaurants/${restaurantId}`, c.tokens.owner1)).json.data.moderationNote, 'Missing food licence');
      assert.equal((await c.api('GET', `/restaurants/${restaurantId}`)).status, 404);
    });
    test('approval makes it public; invalid moves are refused', async () => {
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'APPROVED' })).status, 200); // reconsidered
      assert.equal((await c.api('GET', `/restaurants/${restaurantId}`)).status, 200);
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'APPROVED' })).status, 409); // already approved
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'REJECTED', reason: 'changed my mind' })).status, 409); // approved -> rejected is not allowed
    });
    test('suspension hides it again and can be reversed', async () => {
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'SUSPENDED' })).status, 400);
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'SUSPENDED', reason: 'Hygiene inspection failed' })).status, 200);
      assert.equal((await c.api('GET', `/restaurants/${restaurantId}`)).status, 404);
      assert.equal((await c.api('PATCH', `/admin/restaurants/${restaurantId}/status`, A(), { status: 'APPROVED' })).status, 200);
      assert.equal((await c.api('GET', `/restaurants/${restaurantId}`)).status, 200);
    });
    test('unknown restaurant is 404 and every decision is audited', async () => {
      assert.equal((await c.api('PATCH', '/admin/restaurants/nope/status', A(), { status: 'APPROVED' })).status, 404);
      const log = (await c.api('GET', '/admin/audit-logs?entityType=RESTAURANT&limit=50', A())).json.data.filter((l: any) => l.entityId === restaurantId);
      assert.deepEqual(log.map((l: any) => l.action).sort(), ['RESTAURANT_APPROVED', 'RESTAURANT_APPROVED', 'RESTAURANT_REJECTED', 'RESTAURANT_SUSPENDED']);
    });
  });

  describe('order monitoring', () => {
    test('admins search orders by number, filter by payment, and open the detail view', async () => {
      const o = await placeDelivered(c.tokens.custB);
      const found = (await c.api('GET', `/admin/orders?q=${o.orderNumber}`, A())).json.data;
      assert.equal(found.length, 1);
      assert.equal(found[0].customer.email, c.users.custB.email);
      assert.equal(found[0].payment.status, 'PAID');
      assert.ok((await c.api('GET', `/admin/orders?paymentStatus=PAID&paymentMethod=COD&restaurantId=${c.r1.id}&limit=50`, A())).json.data.some((x: any) => x.id === o.id));
      assert.equal((await c.api('GET', `/admin/orders?paymentStatus=PENDING&q=${o.orderNumber}`, A())).json.data.length, 0);
      const d = await c.api('GET', `/admin/orders/${o.id}`, A());
      assert.equal(d.json.data.items.length, 1);
      assert.equal(d.json.data.statusHistory.at(-1).status, 'DELIVERED');
      assert.equal((await c.api('GET', '/admin/orders/nope', A())).status, 404);
    });
    test('filter validation', async () => {
      assert.equal((await c.api('GET', '/admin/orders?from=2026-12-01&to=2026-01-01', A())).status, 400);
      assert.equal((await c.api('GET', '/admin/orders?status=WRONG', A())).status, 400);
      assert.equal((await c.api('GET', '/admin/orders?limit=0', A())).status, 400);
    });
    test('an admin can still move an order forward through the shared status endpoint', async () => {
      await c.api('POST', '/cart/items', c.tokens.custA, { foodItemId: c.foods.main.id, quantity: 2 });
      const id = (await c.api('POST', '/orders', c.tokens.custA, c.orderBody())).json.data.id;
      assert.equal((await c.api('PATCH', `/orders/${id}/status`, A(), { status: 'ACCEPTED' })).status, 200);
    });
  });

  describe('NGO verification', () => {
    test('unverified NGOs are listed and cannot claim; verifying unlocks claiming immediately', async () => {
      const pending = (await c.api('GET', `/admin/ngos?verified=false&q=${c.tag}`, A())).json.data;
      assert.ok(pending.some((n: any) => n.id === c.ngos.C.id));
      const donationId = await donate();
      assert.equal((await c.api('POST', `/donations/${donationId}/request`, c.tokens.ngoC, {})).status, 403);

      const v = await c.api('PATCH', `/admin/ngos/${c.ngos.C.id}/verification`, A(), { verified: true, note: 'Registration documents checked' });
      assert.equal(v.status, 200);
      assert.equal(v.json.data.isVerified, true);
      assert.equal((await c.api('POST', `/donations/${donationId}/request`, c.tokens.ngoC, {})).status, 201);
      assert.equal((await c.api('PATCH', `/admin/ngos/${c.ngos.C.id}/verification`, A(), { verified: true })).status, 409);
    });
    test('un-verifying blocks new claims again; the decision is audited', async () => {
      assert.equal((await c.api('PATCH', `/admin/ngos/${c.ngos.C.id}/verification`, A(), { verified: false, note: 'Licence expired' })).status, 200);
      const donationId = await donate();
      assert.equal((await c.api('POST', `/donations/${donationId}/request`, c.tokens.ngoC, {})).status, 403);
      const log = (await c.api('GET', '/admin/audit-logs?entityType=NGO&limit=50', A())).json.data.filter((l: any) => l.entityId === c.ngos.C.id);
      assert.deepEqual(log.map((l: any) => l.action).sort(), ['NGO_UNVERIFIED', 'NGO_VERIFIED']);
      assert.equal((await c.api('PATCH', '/admin/ngos/nope/verification', A(), { verified: true })).status, 404);
    });
  });

  describe('donation monitoring and flagging', () => {
    test('admins see full donation details and the NGO requests', async () => {
      const id = await donate();
      await c.api('POST', `/donations/${id}/request`, c.tokens.ngoA, { message: 'Hello' });
      const d = (await c.api('GET', `/admin/donations/${id}`, A())).json.data;
      assert.equal(d.contactPhone, '9876543210');
      assert.equal(d.requests.length, 1);
      assert.equal(d.claimedBy.id, c.ngos.A.id);
      const list = (await c.api('GET', `/admin/donations?status=NGO_REQUESTED&ngoId=${c.ngos.A.id}&limit=50`, A())).json.data;
      assert.ok(list.some((x: any) => x.id === id && x.requestCount === 1));
      const reqs = (await c.api('GET', `/admin/donation-requests?status=PENDING&ngoId=${c.ngos.A.id}&limit=50`, A())).json.data;
      assert.ok(reqs.some((r: any) => r.donation.id === id));
      assert.equal((await c.api('GET', '/admin/donations?expired=true&limit=50', A())).status, 200);
      assert.equal((await c.api('GET', '/admin/donations?status=WRONG', A())).status, 400);
    });
    test('flagging needs a reason, removes the donation from circulation and rejects pending NGO requests', async () => {
      const id = await donate();
      await c.api('POST', `/donations/${id}/request`, c.tokens.ngoA, {});
      assert.equal((await c.api('POST', `/admin/donations/${id}/flag`, A(), {})).status, 400);
      const f = await c.api('POST', `/admin/donations/${id}/flag`, A(), { reason: 'Reported as spoiled' });
      assert.equal(f.status, 200);
      assert.equal(f.json.data.status, 'FLAGGED');
      assert.equal(f.json.data.flagReason, 'Reported as spoiled');
      assert.equal((await c.prisma.donationRequest.findFirstOrThrow({ where: { donationId: id } })).status, 'REJECTED');
      assert.equal((await c.api('GET', `/donations/${id}`)).status, 404);
      assert.equal((await c.api('PATCH', `/donations/${id}/status`, c.tokens.custA, { status: 'ACCEPTED' })).status, 409); // nobody can continue a flagged donation
      assert.equal((await c.api('POST', `/admin/donations/${id}/flag`, A(), { reason: 'again again' })).status, 409);
    });
    test('unflagging returns an uncollected donation to the pool and releases the NGO', async () => {
      const id = await donate();
      await c.api('POST', `/donations/${id}/request`, c.tokens.ngoA, {});
      await c.api('POST', `/admin/donations/${id}/flag`, A(), { reason: 'Looks unsafe' });
      const u = await c.api('POST', `/admin/donations/${id}/unflag`, A(), { reason: 'Inspected: fine' });
      assert.equal(u.json.data.status, 'POSTED');
      assert.equal((await c.prisma.donation.findUniqueOrThrow({ where: { id } })).claimedByNgoId, null);
      assert.equal((await c.api('GET', `/donations/${id}`)).status, 200);
      assert.equal((await c.api('POST', `/admin/donations/${id}/unflag`, A(), {})).status, 409); // not flagged any more
    });
    test('a donation flagged after collection is restored to COLLECTED, never re-offered', async () => {
      const id = await donate();
      await c.api('POST', `/donations/${id}/request`, c.tokens.ngoA, {});
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.custA, { status: 'ACCEPTED' });
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.ngoA, { status: 'PICKUP_SCHEDULED', pickupAt: new Date(Date.now() + 3600_000).toISOString() });
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.ngoA, { status: 'COLLECTED' });
      assert.equal((await c.api('POST', `/admin/donations/${id}/flag`, A(), { reason: 'Food poisoning report' })).json.data.status, 'FLAGGED');
      const u = await c.api('POST', `/admin/donations/${id}/unflag`, A(), {});
      assert.equal(u.json.data.status, 'COLLECTED');
      assert.equal((await c.prisma.donation.findUniqueOrThrow({ where: { id } })).claimedByNgoId, c.ngos.A.id);
    });
    test('finished donations cannot be flagged', async () => {
      const id = await donate();
      await c.api('PATCH', `/donations/${id}/status`, c.tokens.custA, { status: 'CANCELLED' });
      assert.equal((await c.api('POST', `/admin/donations/${id}/flag`, A(), { reason: 'too late now' })).status, 409);
    });
  });

  describe('complaints', () => {
    let complaintId: string; let orderId: string;
    before(async () => { orderId = (await placeDelivered(c.tokens.custA)).id; });
    const body = (extra: object = {}) => ({ category: 'FOOD_QUALITY', subject: 'Food arrived cold', details: 'The biryani was cold and the box was leaking.', ...extra });

    test('a customer files a complaint about their own order; validation and ownership are enforced', async () => {
      const r = await c.api('POST', '/complaints', c.tokens.custA, body({ orderId }));
      assert.equal(r.status, 201);
      complaintId = r.json.data.id;
      assert.equal(r.json.data.status, 'OPEN');
      assert.equal((await c.api('POST', '/complaints', c.tokens.custB, body({ orderId }))).status, 404); // someone else's order
      assert.equal((await c.api('POST', '/complaints', c.tokens.custA, body({ category: 'NOPE' }))).status, 400);
      assert.equal((await c.api('POST', '/complaints', c.tokens.custA, body({ subject: 'x' }))).status, 400);
      assert.equal((await c.api('POST', '/complaints', undefined, body())).status, 401);
    });
    test('a donation can be reported if the reporter can see it', async () => {
      const donationId = await donate(c.tokens.custB);
      assert.equal((await c.api('POST', '/complaints', c.tokens.custA, body({ category: 'DONATION', donationId }))).status, 201);
      assert.equal((await c.api('POST', '/complaints', c.tokens.custA, body({ orderId, donationId }))).status, 400); // order and donation together
    });
    test('people see only their own complaints', async () => {
      assert.ok((await c.api('GET', '/complaints', c.tokens.custA)).json.data.some((x: any) => x.id === complaintId));
      assert.equal((await c.api('GET', '/complaints', c.tokens.custB)).json.data.some((x: any) => x.id === complaintId), false);
      assert.equal((await c.api('GET', `/complaints/${complaintId}`, c.tokens.custB)).status, 404);
      assert.equal((await c.api('GET', `/complaints/${complaintId}`, c.tokens.custA)).status, 200);
    });
    test('pending complaints are counted on the dashboard', async () => {
      assert.ok((await c.api('GET', '/admin/dashboard', A())).json.data.complaints.pending >= 1);
      const open = (await c.api('GET', '/admin/complaints?status=OPEN&limit=50', A())).json.data;
      const mine = open.find((x: any) => x.id === complaintId);
      assert.ok(mine);
      assert.equal(mine.order.id, orderId);
      assert.equal(mine.user.email, c.users.custA.email);
    });
    test('review, resolve with a message, and freeze', async () => {
      const patch = (b: object) => c.api('PATCH', `/admin/complaints/${complaintId}`, A(), b);
      assert.equal((await patch({ status: 'RESOLVED' })).status, 400); // resolution required
      assert.equal((await patch({ status: 'OPEN' })).status, 400); // not an allowed target
      assert.equal((await patch({ status: 'IN_REVIEW' })).json.data.status, 'IN_REVIEW');
      const done = await patch({ status: 'RESOLVED', resolution: 'Refund of 100 rupees issued.' });
      assert.equal(done.status, 200);
      assert.ok(done.json.data.resolvedAt);
      assert.equal((await patch({ status: 'REJECTED', resolution: 'Changed my mind later' })).status, 409);
      const seen = (await c.api('GET', `/complaints/${complaintId}`, c.tokens.custA)).json.data;
      assert.equal(seen.status, 'RESOLVED');
      assert.equal(seen.resolution, 'Refund of 100 rupees issued.');
      assert.equal((await c.api('PATCH', '/admin/complaints/nope', A(), { status: 'IN_REVIEW' })).status, 404);
      assert.equal((await c.api('PATCH', `/admin/complaints/${complaintId}`, c.tokens.custA, { status: 'RESOLVED', resolution: 'Self service' })).status, 403);
    });
  });

  describe('accounts: profile, passwords, sessions, addresses', () => {
    test('profile update validates input', async () => {
      const u = await c.register('profile');
      const r = await c.api('PUT', '/auth/me', u.token, { name: 'New Name', phone: '9876501234' });
      assert.equal(r.json.data.name, 'New Name');
      assert.equal((await c.api('PUT', '/auth/me', u.token, { phone: '123' })).status, 400);
      assert.equal((await c.api('PUT', '/auth/me', u.token, {})).status, 400);
      assert.equal((await c.api('PUT', '/auth/me', u.token, { name: 'N', role: 'ADMIN' })).status, 400); // too short; role is not a field at all
      assert.equal((await c.api('GET', '/auth/me', u.token)).json.data.role, 'CUSTOMER');
    });
    test('forgot password gives the same answer for unknown and known emails', async () => {
      const u = await c.register('forgot');
      const unknown = await c.api('POST', '/auth/forgot-password', undefined, { email: `${c.tag}.nobody@test.local` });
      const known = await c.api('POST', '/auth/forgot-password', undefined, { email: u.email });
      assert.equal(unknown.status, 200);
      assert.equal(known.status, 200);
      assert.equal(unknown.json.message, known.json.message);
      assert.equal(unknown.json.demoResetToken, undefined);
      assert.match(known.json.demoResetToken, /^[a-f0-9]{64}$/); // only because DEMO_RETURN_RESET_TOKEN is on in tests
      assert.equal((await c.api('POST', '/auth/forgot-password', undefined, { email: 'not-an-email' })).status, 400);
    });
    test('the stored reset value is a hash of the token, never the token', async () => {
      const u = await c.register('hashed');
      const token = (await c.api('POST', '/auth/forgot-password', undefined, { email: u.email })).json.demoResetToken;
      const row = await c.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      assert.ok(row.resetToken);
      assert.notEqual(row.resetToken, token);
      assert.equal(row.resetToken!.length, 64);
    });
    test('reset: weak passwords and bad tokens are refused; a good one works exactly once and ends old sessions', async () => {
      const u = await c.register('reset');
      const token = (await c.api('POST', '/auth/forgot-password', undefined, { email: u.email })).json.demoResetToken;
      assert.equal((await c.api('POST', '/auth/reset-password', undefined, { token, password: 'short' })).status, 400);
      assert.equal((await c.api('POST', '/auth/reset-password', undefined, { token: 'a'.repeat(64), password: 'Brand-new1' })).status, 400);
      const ok = await c.api('POST', '/auth/reset-password', undefined, { token, password: 'Brand-new1' });
      assert.equal(ok.status, 200);
      assert.equal((await c.api('POST', '/auth/reset-password', undefined, { token, password: 'Another-pass2' })).status, 400); // single use
      assert.equal((await c.api('POST', '/auth/login', undefined, { email: u.email, password: PASSWORD })).status, 401);
      assert.equal((await c.api('POST', '/auth/login', undefined, { email: u.email, password: 'Brand-new1' })).status, 200);
      assert.equal((await c.api('GET', '/auth/me', u.token)).status, 401); // the token issued before the reset no longer works
    });
    test('an expired reset link is refused', async () => {
      const u = await c.register('expired');
      const token = (await c.api('POST', '/auth/forgot-password', undefined, { email: u.email })).json.demoResetToken;
      await c.prisma.user.update({ where: { id: u.id }, data: { resetExpires: new Date(Date.now() - 1000) } });
      assert.equal((await c.api('POST', '/auth/reset-password', undefined, { token, password: 'Brand-new1' })).status, 400);
    });
    test('a newer reset request replaces the older link', async () => {
      const u = await c.register('twice');
      const first = (await c.api('POST', '/auth/forgot-password', undefined, { email: u.email })).json.demoResetToken;
      const second = (await c.api('POST', '/auth/forgot-password', undefined, { email: u.email })).json.demoResetToken;
      assert.equal((await c.api('POST', '/auth/reset-password', undefined, { token: first, password: 'Brand-new1' })).status, 400);
      assert.equal((await c.api('POST', '/auth/reset-password', undefined, { token: second, password: 'Brand-new1' })).status, 200);
    });
    test('change password: checks the current one, issues a new token, retires the old one', async () => {
      const u = await c.register('change');
      assert.equal((await c.api('POST', '/auth/change-password', u.token, { currentPassword: 'Wrong-pass9', newPassword: 'Fresh-pass1' })).status, 400);
      assert.equal((await c.api('POST', '/auth/change-password', u.token, { currentPassword: PASSWORD, newPassword: PASSWORD })).status, 400);
      assert.equal((await c.api('POST', '/auth/change-password', u.token, { currentPassword: PASSWORD, newPassword: 'short' })).status, 400);
      assert.equal((await c.api('POST', '/auth/change-password', u.token, { currentPassword: PASSWORD, newPassword: 'é'.repeat(40) + '1a' })).status, 400); // over 72 bytes
      const ok = await c.api('POST', '/auth/change-password', u.token, { currentPassword: PASSWORD, newPassword: 'Fresh-pass1' });
      assert.equal(ok.status, 200);
      assert.equal((await c.api('GET', '/auth/me', u.token)).status, 401);
      assert.equal((await c.api('GET', '/auth/me', ok.json.data.token)).status, 200);
      assert.equal((await c.api('POST', '/auth/change-password', undefined, { currentPassword: 'a', newPassword: 'b' })).status, 401);
    });
    test('log out everywhere retires all tokens, including login tokens from other devices', async () => {
      const u = await c.register('everywhere');
      const other = (await c.api('POST', '/auth/login', undefined, { email: u.email, password: PASSWORD })).json.data.token;
      assert.equal((await c.api('GET', '/auth/me', other)).status, 200);
      assert.equal((await c.api('POST', '/auth/logout-all', u.token)).status, 200);
      assert.equal((await c.api('GET', '/auth/me', u.token)).status, 401);
      assert.equal((await c.api('GET', '/auth/me', other)).status, 401);
      const fresh = (await c.api('POST', '/auth/login', undefined, { email: u.email, password: PASSWORD })).json.data.token;
      assert.equal((await c.api('GET', '/auth/me', fresh)).status, 200);
    });
    test('addresses can be edited and deleted, but only by their owner', async () => {
      const mine = await c.register('addr');
      const other = await c.register('addr2');
      const created = await c.api('POST', '/addresses', mine.token, c.address);
      assert.equal(created.status, 201);
      const id = created.json.data.id;
      assert.equal((await c.api('PUT', `/addresses/${id}`, other.token, { city: 'Delhi' })).status, 404);
      assert.equal((await c.api('DELETE', `/addresses/${id}`, other.token)).status, 404);
      assert.equal((await c.api('PUT', `/addresses/${id}`, mine.token, {})).status, 400);
      assert.equal((await c.api('PUT', `/addresses/${id}`, mine.token, { pincode: '12' })).status, 400);
      assert.equal((await c.api('PUT', `/addresses/${id}`, mine.token, { line2: 'Near the temple', isDefault: true })).json.data.isDefault, true);
      assert.equal((await c.api('DELETE', `/addresses/${id}`, mine.token)).status, 200);
      assert.equal((await c.api('GET', '/addresses', mine.token)).json.data.length, 0);
    });
  });
});

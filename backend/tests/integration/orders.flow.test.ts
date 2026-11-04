import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Ctx, INTEGRATION_ENABLED, setup } from './fixtures';

// NOT executed in the authoring sandbox (no database there). Run with TEST_DATABASE_URL set; see README.
describe('Phase 2 API flow', { skip: !INTEGRATION_ENABLED && 'set TEST_DATABASE_URL to run integration tests' }, () => {
  let c: Ctx;
  before(async () => { c = await setup(); });
  after(async () => { await c?.cleanup(); });

  const add = (token: string, foodItemId: string, extra: object = {}) =>
    c.api('POST', '/cart/items', token, { foodItemId, quantity: 1, ...extra });

  describe('cart', () => {
    test('add items, merge identical lines, subtotal is computed from DB prices', async () => {
      assert.equal((await add(c.tokens.custA, c.foods.main.id, { quantity: 2 })).status, 201);
      const r = await add(c.tokens.custA, c.foods.main.id, { quantity: 1, price: 1, unitPrice: 1 }); // client prices are ignored
      assert.equal(r.status, 201);
      assert.equal(r.json.data.items.length, 1);
      assert.equal(r.json.data.items[0].quantity, 3);
      assert.equal(r.json.data.breakdown.subtotal, 600);
    });
    test('unavailable and unknown dishes are rejected', async () => {
      assert.equal((await add(c.tokens.custA, c.foods.off.id)).status, 404);
      assert.equal((await add(c.tokens.custA, 'does-not-exist')).status, 404);
    });
    test('invalid quantity is rejected', async () => {
      assert.equal((await add(c.tokens.custA, c.foods.main.id, { quantity: 0 })).status, 400);
      assert.equal((await add(c.tokens.custA, c.foods.main.id, { quantity: 21 })).status, 400);
    });
    test('mixing restaurants is blocked unless replaceCart is set', async () => {
      const r = await add(c.tokens.custA, c.foods.other.id);
      assert.equal(r.status, 409);
      assert.equal(r.json.details.code, 'CART_RESTAURANT_CONFLICT');
      const ok = await add(c.tokens.custA, c.foods.other.id, { replaceCart: true });
      assert.equal(ok.status, 201);
      assert.equal(ok.json.data.restaurant.id, c.r2.id);
      assert.equal(ok.json.data.items.length, 1);
      await add(c.tokens.custA, c.foods.main.id, { replaceCart: true }); // back to restaurant 1
    });
    test('customization price comes from the stored definition; bad options are rejected', async () => {
      const bad = await add(c.tokens.custB, c.foods.sized.id, { selections: [{ group: 'Size', option: 'Huge' }] });
      assert.equal(bad.status, 400);
      const ok = await add(c.tokens.custB, c.foods.sized.id, { selections: [{ group: 'Size', option: 'Large' }] });
      assert.equal(ok.json.data.items[0].unitPrice, 200); // 150 + 50
      await c.api('DELETE', '/cart', c.tokens.custB);
    });
    test('another customer cannot touch my cart items; my cart is private', async () => {
      const mine = (await c.api('GET', '/cart', c.tokens.custA)).json.data.items[0].id;
      assert.equal((await c.api('PATCH', `/cart/items/${mine}`, c.tokens.custB, { quantity: 5 })).status, 404);
      assert.equal((await c.api('DELETE', `/cart/items/${mine}`, c.tokens.custB)).status, 404);
      assert.equal((await c.api('GET', '/cart', c.tokens.custB)).json.data.items.length, 0);
    });
    test('update quantity and remove', async () => {
      const id = (await c.api('GET', '/cart', c.tokens.custA)).json.data.items[0].id;
      const u = await c.api('PATCH', `/cart/items/${id}`, c.tokens.custA, { quantity: 2 });
      assert.equal(u.json.data.breakdown.subtotal, 400);
      const d = await c.api('DELETE', `/cart/items/${id}`, c.tokens.custA);
      assert.equal(d.json.data.items.length, 0);
      assert.equal((await add(c.tokens.custA, c.foods.main.id, { quantity: 2 })).status, 201);
    });
    test('only customers can use the cart', async () => {
      assert.equal((await c.api('GET', '/cart', c.tokens.owner1)).status, 403);
      assert.equal((await c.api('GET', '/cart')).status, 401);
    });
  });

  describe('checkout pricing and coupons', () => {
    // cart: 2 x 200 = 400, delivery 30, tax 5% = 20, platform fee 5
    test('preview returns the full breakdown', async () => {
      const r = await c.api('POST', '/checkout/preview', c.tokens.custA, {});
      assert.deepEqual(r.json.data.breakdown, { subtotal: 400, discount: 0, tax: 20, deliveryFee: 30, platformFee: 5, total: 455 });
      assert.equal(r.json.data.canCheckout, true);
    });
    test('percentage coupon: tax is charged after the discount', async () => {
      const r = await c.api('POST', '/checkout/preview', c.tokens.custA, { couponCode: c.coupons.pct.code });
      assert.equal(r.json.data.coupon.applied, true);
      assert.deepEqual(r.json.data.breakdown, { subtotal: 400, discount: 40, tax: 18, deliveryFee: 30, platformFee: 5, total: 413 });
    });
    test('unknown, expired and below-minimum coupons are reported, not applied', async () => {
      const unknown = await c.api('POST', '/checkout/preview', c.tokens.custA, { couponCode: 'NOPE123' });
      assert.equal(unknown.json.data.coupon.applied, false);
      assert.equal(unknown.json.data.canCheckout, false);
      const expired = await c.api('POST', '/checkout/preview', c.tokens.custA, { couponCode: c.coupons.expired.code });
      assert.equal(expired.json.data.coupon.error.code, 'EXPIRED');
    });
    test('placing an order with an invalid coupon fails', async () => {
      const r = await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ couponCode: c.coupons.expired.code }));
      assert.equal(r.status, 400);
    });
    test('delivery outside the restaurant city is rejected', async () => {
      const r = await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ address: { ...c.address, city: 'Mumbai' } }));
      assert.equal(r.status, 400);
      assert.equal(r.json.details.code, 'OUT_OF_DELIVERY_AREA');
    });
    test('invalid address and phone are rejected by validation', async () => {
      assert.equal((await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ address: { ...c.address, pincode: '12' } }))).status, 400);
      assert.equal((await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ contactPhone: '123' }))).status, 400);
    });
    test('minimum order value is enforced', async () => {
      await add(c.tokens.custB, c.foods.cheap.id); // 50 < restaurant minimum 100
      const r = await c.api('POST', '/orders', c.tokens.custB, c.orderBody());
      assert.equal(r.status, 400);
      assert.match(r.json.message, /minimum/i);
      await c.api('DELETE', '/cart', c.tokens.custB);
    });
  });

  describe('order placement, access and status transitions', () => {
    let orderId: string;
    test('place a COD order: stored totals match, cart is cleared, coupon usage counted', async () => {
      const r = await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ couponCode: c.coupons.pct.code }));
      assert.equal(r.status, 201);
      orderId = r.json.data.id;
      assert.match(r.json.data.orderNumber, /^FB-\d{6}-[A-Z2-9]{6}$/);
      assert.equal(r.json.data.status, 'PLACED');
      assert.equal(r.json.data.total, 413);
      assert.equal(r.json.data.payment.status, 'PENDING');
      assert.equal(r.json.data.items[0].unitPrice, 200);
      assert.equal((await c.api('GET', '/cart', c.tokens.custA)).json.data.items.length, 0);
      assert.equal((await c.prisma.coupon.findUniqueOrThrow({ where: { id: c.coupons.pct.id } })).usedCount, 1);
    });
    test('placing again with an empty cart fails', async () => {
      assert.equal((await c.api('POST', '/orders', c.tokens.custA, c.orderBody())).status, 400);
    });
    test('unauthorized order access is hidden (404) while the right people can see it', async () => {
      assert.equal((await c.api('GET', `/orders/${orderId}`, c.tokens.custB)).status, 404);
      assert.equal((await c.api('GET', `/orders/${orderId}`, c.tokens.owner2)).status, 404);
      assert.equal((await c.api('GET', `/orders/${orderId}`, c.tokens.custA)).status, 200);
      assert.equal((await c.api('GET', `/orders/${orderId}`, c.tokens.owner1)).status, 200);
      assert.equal((await c.api('GET', `/orders/${orderId}`, c.tokens.admin)).status, 200);
      assert.equal((await c.api('GET', `/orders/${orderId}`)).status, 401);
    });
    test('listings are scoped by role', async () => {
      assert.equal((await c.api('GET', '/orders', c.tokens.custA)).json.data.length, 1);
      assert.equal((await c.api('GET', '/orders', c.tokens.custB)).json.data.length, 0);
      assert.equal((await c.api('GET', '/orders', c.tokens.owner1)).json.data.length, 1);
      assert.equal((await c.api('GET', '/orders', c.tokens.owner2)).json.data.length, 0);
      assert.ok((await c.api('GET', '/orders?active=true', c.tokens.admin)).json.data.some((o: any) => o.id === orderId));
    });
    test('pagination limits are validated', async () => {
      for (const q of ['limit=0', 'limit=51', 'page=0', 'page=-1', 'limit=abc'])
        assert.equal((await c.api('GET', `/orders?${q}`, c.tokens.custA)).status, 400, q);
    });
    test('only the owning restaurant (or admin) can update status', async () => {
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner2, { status: 'ACCEPTED' })).status, 404);
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.custA, { status: 'ACCEPTED' })).status, 403);
    });
    test('invalid transitions are rejected', async () => {
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status: 'PREPARING' })).status, 409);
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status: 'DELIVERED' })).status, 409);
    });
    test('happy path to DELIVERED; COD becomes PAID on delivery; history recorded', async () => {
      for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
        const r = await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status });
        assert.equal(r.status, 200, status);
        assert.equal(r.json.data.status, status);
      }
      const o = (await c.api('GET', `/orders/${orderId}`, c.tokens.custA)).json.data;
      assert.equal(o.payment.status, 'PAID');
      assert.deepEqual(o.statusHistory.map((h: any) => h.status), ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    });
    test('a delivered order cannot be cancelled or changed', async () => {
      assert.equal((await c.api('POST', `/orders/${orderId}/cancel`, c.tokens.custA, {})).status, 409);
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.admin, { status: 'CANCELLED', reason: 'too late' })).status, 409);
    });
    test('customer cancel before preparation restores the coupon', async () => {
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      const placed = await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ couponCode: c.coupons.pct.code }));
      assert.equal(placed.status, 201);
      assert.equal((await c.prisma.coupon.findUniqueOrThrow({ where: { id: c.coupons.pct.id } })).usedCount, 2);
      const r = await c.api('POST', `/orders/${placed.json.data.id}/cancel`, c.tokens.custA, { reason: 'changed my mind' });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.status, 'CANCELLED');
      assert.equal((await c.prisma.coupon.findUniqueOrThrow({ where: { id: c.coupons.pct.id } })).usedCount, 1);
    });
    test('owner must give a reason when rejecting', async () => {
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      const placed = await c.api('POST', '/orders', c.tokens.custA, c.orderBody());
      const id = placed.json.data.id;
      assert.equal((await c.api('PATCH', `/orders/${id}/status`, c.tokens.owner1, { status: 'CANCELLED' })).status, 400);
      assert.equal((await c.api('PATCH', `/orders/${id}/status`, c.tokens.owner1, { status: 'CANCELLED', reason: 'Out of stock' })).status, 200);
    });
    test('a coupon with a global limit of 1 can be used only once', async () => {
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      assert.equal((await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ couponCode: c.coupons.once.code }))).status, 201);
      await add(c.tokens.custB, c.foods.main.id, { quantity: 2 });
      const r = await c.api('POST', '/orders', c.tokens.custB, c.orderBody({ couponCode: c.coupons.once.code }));
      assert.equal(r.status, 400);
      await c.api('DELETE', '/cart', c.tokens.custB);
    });
    test('two simultaneous submits of the same cart create exactly one order', async () => {
      await add(c.tokens.custB, c.foods.main.id, { quantity: 2 });
      const before = await c.prisma.order.count({ where: { userId: c.users.custB.id } });
      const results = await Promise.all([
        c.api('POST', '/orders', c.tokens.custB, c.orderBody()),
        c.api('POST', '/orders', c.tokens.custB, c.orderBody()),
      ]);
      assert.ok(results.some((r) => r.status === 400 || r.status === 409), 'the losing request must be rejected');
      assert.equal(results.filter((r) => r.status === 201).length, 1);
      assert.equal(await c.prisma.order.count({ where: { userId: c.users.custB.id } }), before + 1);
    });
  });

  describe('online payments (demo mode)', () => {
    let orderId: string;
    before(async () => {
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      const r = await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ paymentMethod: 'RAZORPAY' }));
      assert.equal(r.status, 201);
      orderId = r.json.data.id;
      assert.equal(r.json.next.action, 'PAY_ONLINE');
    });
    test('COD orders have no online payment', async () => {
      await add(c.tokens.custB, c.foods.main.id, { quantity: 2 });
      const cod = await c.api('POST', '/orders', c.tokens.custB, c.orderBody());
      assert.equal((await c.api('POST', `/payments/orders/${cod.json.data.id}/create`, c.tokens.custB)).status, 400);
    });
    test('another customer cannot pay for or inspect my order payment', async () => {
      assert.equal((await c.api('POST', `/payments/orders/${orderId}/create`, c.tokens.custB)).status, 404);
      assert.equal((await c.api('POST', `/payments/orders/${orderId}/verify`, c.tokens.custB, { provider: 'demo', outcome: 'success' })).status, 404);
    });
    test('create is clearly labelled demo mode', async () => {
      const r = await c.api('POST', `/payments/orders/${orderId}/create`, c.tokens.custA);
      assert.equal(r.json.data.mode, 'demo');
      assert.match(r.json.data.notice, /DEMO/);
      assert.equal(r.json.data.razorpay, null);
    });
    test('an unpaid online order cannot be accepted by the restaurant', async () => {
      const r = await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status: 'ACCEPTED' });
      assert.equal(r.status, 409);
      assert.match(r.json.message, /payment/i);
    });
    test('a real-Razorpay verify request is refused for a demo payment (cannot fake success)', async () => {
      const r = await c.api('POST', `/payments/orders/${orderId}/verify`, c.tokens.custA, {
        provider: 'razorpay', razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'deadbeef' });
      assert.equal(r.status, 400);
      assert.equal((await c.api('GET', `/orders/${orderId}`, c.tokens.custA)).json.data.payment.status, 'PENDING');
    });
    test('failure then retry then success', async () => {
      const fail = await c.api('POST', `/payments/orders/${orderId}/verify`, c.tokens.custA, { provider: 'demo', outcome: 'failure' });
      assert.equal(fail.json.data.payment.status, 'FAILED');
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status: 'ACCEPTED' })).status, 409);
      await c.api('POST', `/payments/orders/${orderId}/create`, c.tokens.custA); // retry
      const ok = await c.api('POST', `/payments/orders/${orderId}/verify`, c.tokens.custA, { provider: 'demo', outcome: 'success' });
      assert.equal(ok.json.data.payment.status, 'PAID');
      assert.equal(ok.json.data.payment.isDemo, true);
      // replaying verify is idempotent, and a late "failed" report can never downgrade a paid payment
      assert.equal((await c.api('POST', `/payments/orders/${orderId}/verify`, c.tokens.custA, { provider: 'demo', outcome: 'success' })).json.data.alreadyPaid, true);
      assert.equal((await c.api('POST', `/payments/orders/${orderId}/failed`, c.tokens.custA, { reason: 'FAILED' })).json.data.payment.status, 'PAID');
      assert.equal((await c.api('PATCH', `/orders/${orderId}/status`, c.tokens.owner1, { status: 'ACCEPTED' })).status, 200);
    });
    test('cancelling a paid demo order refunds it (simulated)', async () => {
      const r = await c.api('POST', `/orders/${orderId}/cancel`, c.tokens.custA, { reason: 'test' });
      assert.equal(r.status, 200);
      assert.equal(r.json.data.payment.status, 'REFUNDED');
    });
    test('user closing the payment window marks it failed and allows retry', async () => {
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      const o = await c.api('POST', '/orders', c.tokens.custA, c.orderBody({ paymentMethod: 'UPI' }));
      const id = o.json.data.id;
      await c.api('POST', `/payments/orders/${id}/create`, c.tokens.custA);
      const f = await c.api('POST', `/payments/orders/${id}/failed`, c.tokens.custA, { reason: 'CANCELLED_BY_USER' });
      assert.equal(f.json.data.payment.status, 'FAILED');
      assert.equal(f.json.data.canRetry, true);
    });
  });

  describe('reviews', () => {
    let deliveredOrderId: string; let orderItemId: string; let pendingOrderId: string;
    before(async () => {
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      deliveredOrderId = (await c.api('POST', '/orders', c.tokens.custA, c.orderBody())).json.data.id;
      for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'])
        await c.api('PATCH', `/orders/${deliveredOrderId}/status`, c.tokens.owner1, { status });
      orderItemId = (await c.api('GET', `/orders/${deliveredOrderId}`, c.tokens.custA)).json.data.items[0].id;
      await add(c.tokens.custA, c.foods.main.id, { quantity: 2 });
      pendingOrderId = (await c.api('POST', '/orders', c.tokens.custA, c.orderBody())).json.data.id;
    });
    let reviewId: string;
    test('cannot review an order that is not delivered', async () => {
      assert.equal((await c.api('POST', '/reviews/restaurants', c.tokens.custA, { orderId: pendingOrderId, rating: 5 })).status, 409);
    });
    test("cannot review someone else's order", async () => {
      assert.equal((await c.api('POST', '/reviews/restaurants', c.tokens.custB, { orderId: deliveredOrderId, rating: 5 })).status, 404);
    });
    test('rating must be an integer from 1 to 5', async () => {
      for (const rating of [0, 6, 3.5, -1])
        assert.equal((await c.api('POST', '/reviews/restaurants', c.tokens.custA, { orderId: deliveredOrderId, rating })).status, 400, String(rating));
    });
    test('a delivered order can be reviewed once, and the restaurant average updates', async () => {
      const before = await c.prisma.restaurant.findUniqueOrThrow({ where: { id: c.r1.id } });
      const r = await c.api('POST', '/reviews/restaurants', c.tokens.custA, { orderId: deliveredOrderId, rating: 4, comment: 'Tasty' });
      assert.equal(r.status, 201);
      reviewId = r.json.data.id;
      const after = await c.prisma.restaurant.findUniqueOrThrow({ where: { id: c.r1.id } });
      assert.equal(after.ratingCount, before.ratingCount + 1);
      assert.equal(after.rating, 4); // first rating on a restaurant that started at 0
      assert.equal((await c.api('POST', '/reviews/restaurants', c.tokens.custA, { orderId: deliveredOrderId, rating: 5 })).status, 409);
    });
    test('food item review: once per ordered line', async () => {
      assert.equal((await c.api('POST', '/reviews/foods', c.tokens.custA, { orderItemId, rating: 5 })).status, 201);
      assert.equal((await c.api('POST', '/reviews/foods', c.tokens.custA, { orderItemId, rating: 1 })).status, 409);
      assert.equal((await c.api('POST', '/reviews/foods', c.tokens.custB, { orderItemId, rating: 1 })).status, 404);
      const food = await c.prisma.foodItem.findUniqueOrThrow({ where: { id: c.foods.main.id } });
      assert.equal(food.rating, 5);
      assert.equal(food.ratingCount, 1);
    });
    test('public review listing is paginated and validated', async () => {
      const r = await c.api('GET', `/reviews/restaurants/${c.r1.id}?limit=1`);
      assert.equal(r.status, 200);
      assert.equal(r.json.data.length, 1);
      assert.equal(r.json.meta.total, 1);
      assert.equal((await c.api('GET', `/reviews/restaurants/${c.r1.id}?limit=51`)).status, 400);
    });
    test('only the author can edit; author or admin can delete; others see 404', async () => {
      assert.equal((await c.api('PUT', `/reviews/restaurants/${reviewId}`, c.tokens.custB, { rating: 1 })).status, 404);
      assert.equal((await c.api('DELETE', `/reviews/restaurants/${reviewId}`, c.tokens.custB)).status, 404);
      assert.equal((await c.api('PUT', `/reviews/restaurants/${reviewId}`, c.tokens.admin, { rating: 1 })).status, 403); // admin is not a CUSTOMER
      const edit = await c.api('PUT', `/reviews/restaurants/${reviewId}`, c.tokens.custA, { rating: 2 });
      assert.equal(edit.status, 200);
      assert.equal((await c.prisma.restaurant.findUniqueOrThrow({ where: { id: c.r1.id } })).rating, 2);
      assert.equal((await c.api('DELETE', `/reviews/restaurants/${reviewId}`, c.tokens.admin)).status, 200);
      assert.equal((await c.prisma.restaurant.findUniqueOrThrow({ where: { id: c.r1.id } })).ratingCount, 0);
    });
  });
});

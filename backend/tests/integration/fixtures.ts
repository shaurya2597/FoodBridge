/**
 * Integration-test fixtures. These tests need a REAL PostgreSQL database that has had migrations applied.
 * They run only when TEST_DATABASE_URL is set, so they can never touch your dev data by accident:
 * point it at a separate database (e.g. foodbridge_test). Everything they create carries a unique run tag
 * and is deleted again afterwards.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type * as AppModule from '../../src/app';
import type * as PrismaModule from '../../src/config/prisma';
import type * as SocketsModule from '../../src/sockets';

export const INTEGRATION_ENABLED = Boolean(process.env.TEST_DATABASE_URL);
export const PASSWORD = 'Test@1234';

export async function setup() {
  // Must happen before the app modules are imported (they read env at import time).
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-test-secret-0123456789abcdef';
  process.env.RAZORPAY_KEY_ID = '';
  process.env.RAZORPAY_KEY_SECRET = '';
  process.env.ALLOW_DEMO_PAYMENTS = 'true';
  process.env.ENFORCE_OPENING_HOURS = 'false';
  process.env.TAX_RATE_PERCENT = '5';
  process.env.PLATFORM_FEE = '5';
  process.env.DEMO_RETURN_RESET_TOKEN = 'true'; // lets the tests read the reset token without an email server
  process.env.SMTP_HOST = '';

  // require() (not a top-level import) so the app reads the env vars set above. Same module cache either way.
  const { app } = require('../../src/app') as typeof AppModule;
  const { prisma } = require('../../src/config/prisma') as typeof PrismaModule;
  const { initSockets, getIo } = require('../../src/sockets') as typeof SocketsModule;
  const bcrypt = require('bcryptjs') as typeof import('bcryptjs');

  const tag = `it${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const server = http.createServer(app);
  initSockets(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function api(method: string, path: string, token?: string, body?: unknown) {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  const hash = await bcrypt.hash(PASSWORD, 4);
  const mkUser = (name: string, role: any) =>
    prisma.user.create({ data: { name, email: `${tag}.${name}@test.local`, passwordHash: hash, role, phone: '9000000000' } });
  const users = {
    custA: await mkUser('custa', 'CUSTOMER'), custB: await mkUser('custb', 'CUSTOMER'),
    owner1: await mkUser('owner1', 'RESTAURANT_OWNER'), owner2: await mkUser('owner2', 'RESTAURANT_OWNER'),
    admin: await mkUser('admin', 'ADMIN'), admin2: await mkUser('admin2', 'ADMIN'),
    ngoA: await mkUser('ngoa', 'NGO'), ngoB: await mkUser('ngob', 'NGO'), ngoC: await mkUser('ngoc', 'NGO'),
  };
  const tokens = {} as Record<keyof typeof users, string>;
  for (const k of Object.keys(users) as (keyof typeof users)[]) {
    const r = await api('POST', '/auth/login', undefined, { email: users[k].email, password: PASSWORD });
    tokens[k] = r.json.data.token;
  }

  const mkNgo = (userId: string, orgName: string, isVerified: boolean) =>
    prisma.nGOProfile.create({ data: { userId, orgName: `${tag} ${orgName}`, contactEmail: `${tag}.${orgName}@test.local`, contactPhone: '9111111111', serviceCity: 'Jodhpur', isVerified } });
  const ngos = {
    A: await mkNgo(users.ngoA.id, 'NgoA', true), B: await mkNgo(users.ngoB.id, 'NgoB', true), C: await mkNgo(users.ngoC.id, 'NgoC (unverified)', false),
  };

  const mkRestaurant = (ownerId: string, name: string, extra: object = {}) =>
    prisma.restaurant.create({
      data: { ownerId, name: `${tag} ${name}`, slug: `${tag}-${name}`, description: 'Integration test restaurant', cuisines: ['Test'],
        imageUrl: 'https://example.com/r.png', address: '1 Test Road', city: 'Jodhpur', status: 'APPROVED', isOpen: true,
        deliveryFee: 30, minOrder: 100, deliveryTime: 30, ...extra },
    });
  const r1 = await mkRestaurant(users.owner1.id, 'r1');
  const r2 = await mkRestaurant(users.owner2.id, 'r2');
  const cat = (restaurantId: string) => prisma.foodCategory.create({ data: { restaurantId, name: 'Mains' } });
  const c1 = await cat(r1.id); const c2 = await cat(r2.id);
  const mkFood = (restaurantId: string, categoryId: string, name: string, price: number, extra: object = {}) =>
    prisma.foodItem.create({ data: { restaurantId, categoryId, name, description: 'Test dish', price, imageUrl: 'https://example.com/f.png', foodType: 'VEG', ...extra } });
  const foods = {
    main: await mkFood(r1.id, c1.id, 'Main', 200),
    cheap: await mkFood(r1.id, c1.id, 'Cheap', 50),
    off: await mkFood(r1.id, c1.id, 'Unavailable', 100, { isAvailable: false }),
    sized: await mkFood(r1.id, c1.id, 'Sized', 150, { customizations: [{ name: 'Size', options: [{ label: 'Regular', extraPrice: 0 }, { label: 'Large', extraPrice: 50 }] }] }),
    other: await mkFood(r2.id, c2.id, 'OtherRestaurantDish', 120),
  };

  const future = new Date(Date.now() + 86_400_000);
  const coupons = {
    pct: await prisma.coupon.create({ data: { code: `${tag}PCT`.toUpperCase(), description: '10% off', discountType: 'PERCENT', value: 10, minOrder: 300, validUntil: future, perUserLimit: 5 } }),
    expired: await prisma.coupon.create({ data: { code: `${tag}OLD`.toUpperCase(), description: 'old', discountType: 'FLAT', value: 20, validUntil: new Date(Date.now() - 1000) } }),
    once: await prisma.coupon.create({ data: { code: `${tag}ONCE`.toUpperCase(), description: 'once', discountType: 'FLAT', value: 20, validUntil: future, usageLimit: 1, perUserLimit: 1 } }),
  };

  const address = { label: 'Home', line1: '12 Test Street', city: 'Jodhpur', state: 'Rajasthan', pincode: '342001' };
  const orderBody = (extra: object = {}) => ({
    address, contactName: 'Test Customer', contactPhone: '9876543210', paymentMethod: 'COD', ...extra,
  });

  /** A valid donation body: prepared 30 min ago, safe to collect for the next 3 hours. */
  const donationBody = (extra: object = {}) => ({
    foodName: 'Dal and rice', category: 'Cooked meal', quantity: '10 boxes', servings: 10, foodType: 'VEG',
    preparedAt: new Date(Date.now() - 30 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    pickupAddress: '12 Secret Lane, Ratanada, Jodhpur', city: 'Jodhpur', contactPhone: '9876543210', safetyConfirmed: true, ...extra,
  });
  // A random phone per run, so leftovers from a crashed run can never trip the "3 open requests per phone" limit.
  const phone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const anonPhone = phone();
  const assistanceBody = (extra: object = {}) => ({
    name: 'Ramesh Kumar', phone: anonPhone, people: 5, requirements: ['Cooked meal'], location: 'Near Clock Tower, Jodhpur', city: 'Jodhpur', ...extra,
  });

  /** Registers a throwaway account through the real API (cleaned up afterwards by its email prefix). */
  async function register(name: string, role: 'CUSTOMER' | 'RESTAURANT_OWNER' = 'CUSTOMER') {
    const email = `${tag}.${name}@test.local`;
    const r = await api('POST', '/auth/register', undefined, { name: `Test ${name}`, email, password: PASSWORD, role });
    return { email, token: r.json.data.token as string, id: r.json.data.user.id as string, status: r.status };
  }

  async function cleanup() {
    // every account of this run, including ones registered through the API during the tests
    const userIds = (await prisma.user.findMany({ where: { email: { startsWith: `${tag}.` } }, select: { id: true } })).map((u) => u.id);
    const restaurantIds = [r1.id, r2.id];
    const ngoIds = Object.values(ngos).map((n) => n.id);
    await prisma.auditLog.deleteMany({ where: { adminId: { in: userIds } } });
    await prisma.complaint.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.donationRequest.deleteMany({ where: { OR: [{ ngoId: { in: ngoIds } }, { donation: { donorId: { in: userIds } } }] } });
    await prisma.donation.deleteMany({ where: { OR: [{ donorId: { in: userIds } }, { claimedByNgoId: { in: ngoIds } }] } });
    await prisma.foodAssistanceRequest.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { assignedNgoId: { in: ngoIds } }, { phone: anonPhone }] } });
    await prisma.nGOProfile.deleteMany({ where: { id: { in: ngoIds } } });
    await prisma.foodReview.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.review.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: { in: userIds } } } });
    await prisma.cart.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.coupon.deleteMany({ where: { id: { in: Object.values(coupons).map((c) => c.id) } } });
    await prisma.foodItem.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
    await prisma.foodCategory.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
    await prisma.restaurant.deleteMany({ where: { OR: [{ id: { in: restaurantIds } }, { ownerId: { in: userIds } }] } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    getIo()?.close(); // also closes the underlying HTTP server
    server.closeAllConnections?.();
  }

  return { api, base, prisma, tag, users, tokens, ngos, r1, r2, foods, coupons, address, orderBody, donationBody, assistanceBody, phone, register, cleanup };
}
export type Ctx = Awaited<ReturnType<typeof setup>>;

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { getPagination, pageMeta } from '../utils/pagination';
import { AuthUser } from '../middleware/auth';
import { disconnectUser, emitToUser, syncNgoRoom } from '../sockets';
import { emitDonationEvent } from '../sockets/donationEvents';
import { audit } from './auditService';
import { ORDER_INCLUDE, toOrderResponse } from './orderService';
import { checkBlockTarget } from './rules/adminRules';
import { bucketDonations, bucketOrders, istDayRange } from './rules/analyticsBuckets';
import { PENDING_COMPLAINT_STATUSES, ComplaintStatus, checkComplaintTransition } from './rules/complaintRules';
import { checkFlag, statusAfterUnflag } from './rules/donationModeration';
import { ACTIVE_DONATION_STATUSES, DonationStatus } from './rules/donationStateMachine';
import { toDonationView } from './rules/donationView';
import { RestaurantStatus, checkRestaurantStatusChange } from './rules/restaurantModeration';

const iso = (d: Date) => d.toISOString();
const counts = <T extends Record<string, any>>(groups: T[], key: keyof T) =>
  Object.fromEntries(groups.map((g) => [String(g[key]), (g as any)._count._all])) as Record<string, number>;
const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });
const page = (query: any) => getPagination(query);
interface HistoryEntry { status: string; at: string; by: string; note?: string }

// ------------------------------------------------------------------ dashboard
export async function getDashboard() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const [usersByRole, blockedUsers, restaurantsByStatus, ordersByStatus, orders24h, revenue, activeDonations, donated, pendingComplaints, unverifiedNgos, openAssistance] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { isBlocked: true } }),
    prisma.restaurant.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.count({ where: { createdAt: { gte: dayAgo } } }),
    // Revenue = money actually received on orders that were not cancelled.
    prisma.payment.aggregate({ where: { status: 'PAID', order: { status: { not: 'CANCELLED' } } }, _sum: { amount: true } }),
    prisma.donation.count({ where: { status: { in: ACTIVE_DONATION_STATUSES }, expiresAt: { gt: now } } }),
    prisma.donation.aggregate({ where: { status: { in: ['COLLECTED', 'DISTRIBUTED'] } }, _sum: { servings: true }, _count: { _all: true } }),
    prisma.complaint.count({ where: { status: { in: PENDING_COMPLAINT_STATUSES } } }),
    prisma.nGOProfile.count({ where: { isVerified: false } }),
    prisma.foodAssistanceRequest.count({ where: { status: 'OPEN' } }),
  ]);
  const byRole = counts(usersByRole, 'role');
  const byRestaurant = counts(restaurantsByStatus, 'status');
  const byOrder = counts(ordersByStatus, 'status');
  return {
    users: { total: Object.values(byRole).reduce((a, b) => a + b, 0), byRole, blocked: blockedUsers },
    restaurants: { total: Object.values(byRestaurant).reduce((a, b) => a + b, 0), byStatus: byRestaurant, pendingApproval: byRestaurant.PENDING ?? 0 },
    orders: { total: Object.values(byOrder).reduce((a, b) => a + b, 0), byStatus: byOrder, last24Hours: orders24h },
    revenue: { total: Number(revenue._sum.amount ?? 0), currency: 'INR' },
    donations: { active: activeDonations, collectedOrDistributed: donated._count._all, servingsDonated: donated._sum.servings ?? 0 },
    ngos: { awaitingVerification: unverifiedNgos },
    assistance: { open: openAssistance },
    complaints: { pending: pendingComplaints },
    generatedAt: iso(now),
  };
}

// ------------------------------------------------------------------ analytics
export async function getAnalytics(days: number) {
  const now = new Date();
  const { keys, since } = istDayRange(now, days);
  const inRange = { createdAt: { gte: since } };
  const notCancelled = { status: { not: 'CANCELLED' as const } };

  const [orderRows, donationRows, popular, topItems, donationsByStatus, savedAll, assistanceByStatus, a1, a2, a3, a4] = await Promise.all([
    prisma.order.findMany({ where: inRange, select: { createdAt: true, total: true, status: true, payment: { select: { status: true } } }, take: 50_000 }),
    prisma.donation.findMany({ where: inRange, select: { createdAt: true, servings: true, status: true }, take: 50_000 }),
    prisma.order.groupBy({ by: ['restaurantId'], where: { ...inRange, ...notCancelled }, _count: { _all: true }, _sum: { total: true }, orderBy: { _count: { restaurantId: 'desc' } }, take: 5 }),
    prisma.orderItem.groupBy({ by: ['foodItemId'], where: { order: { ...inRange, ...notCancelled } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 10 }),
    prisma.donation.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.donation.aggregate({ where: { status: { in: ['COLLECTED', 'DISTRIBUTED'] } }, _sum: { servings: true } }),
    prisma.foodAssistanceRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    // "Active users" = people who did something in the window: ordered, donated, asked for help or reviewed.
    prisma.order.findMany({ where: inRange, distinct: ['userId'], select: { userId: true }, take: 50_000 }),
    prisma.donation.findMany({ where: inRange, distinct: ['donorId'], select: { donorId: true }, take: 50_000 }),
    prisma.foodAssistanceRequest.findMany({ where: { ...inRange, userId: { not: null } }, distinct: ['userId'], select: { userId: true }, take: 50_000 }),
    prisma.review.findMany({ where: inRange, distinct: ['userId'], select: { userId: true }, take: 50_000 }),
  ]);

  const [restaurants, foods] = await Promise.all([
    prisma.restaurant.findMany({ where: { id: { in: popular.map((p) => p.restaurantId) } }, select: { id: true, name: true, city: true } }),
    prisma.foodItem.findMany({ where: { id: { in: topItems.map((t) => t.foodItemId) } }, select: { id: true, name: true, restaurant: { select: { name: true } } } }),
  ]);
  const savedInRange = donationRows.filter((d) => d.status === 'COLLECTED' || d.status === 'DISTRIBUTED').reduce((s, d) => s + d.servings, 0);
  const ordersOverTime = bucketOrders(orderRows.map((o) => ({ createdAt: o.createdAt, total: Number(o.total), status: o.status, paymentStatus: o.payment?.status ?? null })), keys);
  const active = new Set<string>([...a1.map((x) => x.userId), ...a2.map((x) => x.donorId), ...a3.map((x) => x.userId!), ...a4.map((x) => x.userId)]);

  return {
    range: { days, from: iso(since), to: iso(now), timezone: 'Asia/Kolkata' },
    ordersOverTime,
    revenueTrend: ordersOverTime.map((d) => ({ date: d.date, revenue: d.revenue })),
    totals: { orders: ordersOverTime.reduce((s, d) => s + d.orders, 0), revenue: Math.round(ordersOverTime.reduce((s, d) => s + d.revenue, 0) * 100) / 100 },
    popularRestaurants: popular.map((p) => ({ restaurantId: p.restaurantId, name: restaurants.find((r) => r.id === p.restaurantId)?.name ?? 'Unknown', orders: p._count._all, revenue: Number(p._sum.total ?? 0) })),
    topFoodItems: topItems.map((t) => { const f = foods.find((x) => x.id === t.foodItemId); return { foodItemId: t.foodItemId, name: f?.name ?? 'Unknown', restaurant: f?.restaurant.name ?? null, quantitySold: t._sum.quantity ?? 0 }; }),
    donations: {
      overTime: bucketDonations(donationRows, keys),
      byStatus: counts(donationsByStatus, 'status'),
      servingsSavedInRange: savedInRange,
      servingsSavedAllTime: savedAll._sum.servings ?? 0,
    },
    assistance: { byStatus: counts(assistanceByStatus, 'status') },
    activeUsers: { count: active.size, windowDays: days },
  };
}

// ------------------------------------------------------------------ users
export async function listUsers(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.blocked) where.isBlocked = query.blocked === 'true';
  if (query.q) where.OR = [{ name: contains(query.q) }, { email: contains(query.q) }];
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take,
      select: { id: true, name: true, email: true, phone: true, role: true, isBlocked: true, blockedReason: true, createdAt: true, ngoProfile: { select: { id: true, orgName: true, isVerified: true } } }, // never passwordHash or reset fields
    }),
  ]);
  return { data: rows, meta: pageMeta(total, p, limit) };
}

export async function setUserBlocked(admin: AuthUser, id: string, body: { blocked: boolean; reason?: string }) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError(404, 'User not found');
  const check = checkBlockTarget(admin, target, body.blocked);
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id }, data: { isBlocked: body.blocked, blockedReason: body.blocked ? body.reason! : null } });
    await audit(tx, admin.id, body.blocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED', 'USER', id, { reason: body.reason ?? null, email: target.email });
    return u;
  });
  // HTTP requests are already refused (the database is checked every time). This also ends live Socket.IO sessions now.
  if (body.blocked) disconnectUser(id);
  return { id: updated.id, name: updated.name, email: updated.email, role: updated.role, isBlocked: updated.isBlocked, blockedReason: updated.blockedReason };
}

// ------------------------------------------------------------------ restaurants
export async function listRestaurants(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.RestaurantWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
  if (query.q) where.OR = [{ name: contains(query.q) }, { owner: { email: contains(query.q) } }];
  const [total, rows] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take,
      include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { orders: true, foods: true } } },
    }),
  ]);
  return { data: rows, meta: pageMeta(total, p, limit) };
}

export async function setRestaurantStatus(admin: AuthUser, id: string, body: { status: RestaurantStatus; reason?: string }) {
  const r = await prisma.restaurant.findUnique({ where: { id } });
  if (!r) throw new AppError(404, 'Restaurant not found');
  const from = r.status as RestaurantStatus;
  const check = checkRestaurantStatusChange(from, body.status, body.reason);
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  await prisma.$transaction(async (tx) => {
    const moved = await tx.restaurant.updateMany({
      where: { id, status: from }, // someone else may have moderated it in the meantime
      // The note is only meaningful (and only kept) for decisions that go against the owner.
      data: { status: body.status, moderationNote: body.status === 'APPROVED' ? null : body.reason ?? null },
    });
    if (moved.count !== 1) throw new AppError(409, 'This restaurant was just updated by someone else. Refresh and try again.');
    await audit(tx, admin.id, `RESTAURANT_${body.status}`, 'RESTAURANT', id, { from, reason: body.reason ?? null, name: r.name });
  });
  emitToUser(r.ownerId, 'restaurant:status', { restaurantId: id, name: r.name, status: body.status, reason: body.reason ?? null, at: iso(new Date()) });
  return prisma.restaurant.findUniqueOrThrow({ where: { id }, include: { owner: { select: { id: true, name: true, email: true } } } });
}

// ------------------------------------------------------------------ orders (read-only here; status changes use PATCH /orders/:id/status)
const adminOrderInclude = { ...ORDER_INCLUDE, user: { select: { id: true, name: true, email: true, phone: true } } } satisfies Prisma.OrderInclude;

export async function listOrders(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.OrderWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.restaurantId) where.restaurantId = query.restaurantId;
  if (query.userId) where.userId = query.userId;
  if (query.paymentStatus || query.paymentMethod)
    where.payment = { ...(query.paymentStatus && { status: query.paymentStatus }), ...(query.paymentMethod && { method: query.paymentMethod }) };
  if (query.from || query.to) where.createdAt = { ...(query.from && { gte: query.from }), ...(query.to && { lte: query.to }) };
  if (query.q) where.OR = [{ orderNumber: contains(query.q) }, { contactName: contains(query.q) }];
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: adminOrderInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows.map((o) => ({ ...toOrderResponse(o), customer: o.user })), meta: pageMeta(total, p, limit) };
}

export async function getOrderDetail(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: adminOrderInclude });
  if (!o) throw new AppError(404, 'Order not found');
  return { ...toOrderResponse(o), customer: o.user };
}

// ------------------------------------------------------------------ NGOs
export async function listNgos(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.NGOProfileWhereInput = {};
  if (query.verified) where.isVerified = query.verified === 'true';
  if (query.q) where.OR = [{ orgName: contains(query.q) }, { serviceCity: contains(query.q) }, { registrationNo: contains(query.q) }];
  const [total, rows] = await Promise.all([
    prisma.nGOProfile.count({ where }),
    prisma.nGOProfile.findMany({
      where, orderBy: [{ isVerified: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }], skip, take,
      include: { user: { select: { id: true, name: true, email: true, isBlocked: true } }, _count: { select: { donations: true, requests: true, assistanceRequests: true } } },
    }),
  ]);
  return { data: rows, meta: pageMeta(total, p, limit) };
}

export async function setNgoVerification(admin: AuthUser, id: string, body: { verified: boolean; note?: string }) {
  const ngo = await prisma.nGOProfile.findUnique({ where: { id } });
  if (!ngo) throw new AppError(404, 'NGO not found');
  if (ngo.isVerified === body.verified) throw new AppError(409, `This NGO is already ${body.verified ? 'verified' : 'unverified'}`);

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.nGOProfile.update({ where: { id }, data: { isVerified: body.verified } });
    await audit(tx, admin.id, body.verified ? 'NGO_VERIFIED' : 'NGO_UNVERIFIED', 'NGO', id, { note: body.note ?? null, orgName: ngo.orgName });
    return u;
  });
  syncNgoRoom(ngo.userId, body.verified); // live donation alerts start/stop immediately for its open sockets
  emitToUser(ngo.userId, 'ngo:verification', { verified: body.verified, note: body.note ?? null, at: iso(new Date()) });
  return updated;
}

// ------------------------------------------------------------------ donations
const donationInclude = {
  claimedBy: { select: { id: true, orgName: true, serviceCity: true, isVerified: true, contactPhone: true } },
  _count: { select: { requests: true } },
} satisfies Prisma.DonationInclude;

export async function listDonations(query: any) {
  const now = new Date();
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.DonationWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
  if (query.donorType) where.donorType = query.donorType;
  if (query.ngoId) where.claimedByNgoId = query.ngoId;
  if (query.expired) where.expiresAt = query.expired === 'true' ? { lte: now } : { gt: now };
  if (query.q) where.OR = [{ foodName: contains(query.q) }, { donorName: contains(query.q) }];
  const [total, rows] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.donation.findMany({ where, include: donationInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows.map((d) => toDonationView(d, 'ADMIN', now, { claimedBy: d.claimedBy, requestCount: d._count.requests, flagReason: d.flagReason })), meta: pageMeta(total, p, limit) };
}

export async function getDonationDetail(id: string) {
  const now = new Date();
  const d = await prisma.donation.findUnique({ where: { id }, include: donationInclude });
  if (!d) throw new AppError(404, 'Donation not found');
  const requests = await prisma.donationRequest.findMany({
    where: { donationId: id }, orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, message: true, createdAt: true, ngo: { select: { id: true, orgName: true, isVerified: true } } },
  });
  return toDonationView(d, 'ADMIN', now, { claimedBy: d.claimedBy, requests, flagReason: d.flagReason });
}

export async function listDonationRequests(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.DonationRequestWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.ngoId) where.ngoId = query.ngoId;
  const [total, rows] = await Promise.all([
    prisma.donationRequest.count({ where }),
    prisma.donationRequest.findMany({
      where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take,
      include: { ngo: { select: { id: true, orgName: true, isVerified: true } }, donation: { select: { id: true, foodName: true, status: true, city: true, expiresAt: true, servings: true } } },
    }),
  ]);
  return { data: rows, meta: pageMeta(total, p, limit) };
}

export async function flagDonation(admin: AuthUser, id: string, reason: string) {
  const now = new Date();
  const d = await prisma.donation.findUnique({ where: { id }, include: { claimedBy: { select: { userId: true } } } });
  if (!d) throw new AppError(404, 'Donation not found');
  const from = d.status as DonationStatus;
  const check = checkFlag(from, reason);
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  const history = [...((d.statusHistory as unknown as HistoryEntry[]) ?? []), { status: 'FLAGGED', at: iso(now), by: 'ADMIN', note: reason }];
  await prisma.$transaction(async (tx) => {
    const moved = await tx.donation.updateMany({
      where: { id, status: from, version: d.version },
      data: { status: 'FLAGGED', flagReason: reason, version: { increment: 1 }, statusHistory: history as unknown as Prisma.InputJsonValue },
    });
    if (moved.count !== 1) throw new AppError(409, 'This donation was just updated by someone else. Refresh and try again.');
    await tx.donationRequest.updateMany({ where: { donationId: id, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: 'REJECTED' } });
    await audit(tx, admin.id, 'DONATION_FLAGGED', 'DONATION', id, { from, reason });
  });
  const at = iso(now);
  emitDonationEvent('donation:status', { donationId: id, foodName: d.foodName, status: 'FLAGGED', previousStatus: from, at }, { userIds: [d.donorId, d.claimedBy?.userId] });
  emitDonationEvent('donation:availability', { donationId: id, status: 'FLAGGED', available: false, at }, { toNgos: true });
  return getDonationDetail(id);
}

export async function unflagDonation(admin: AuthUser, id: string, note?: string) {
  const now = new Date();
  const d = await prisma.donation.findUnique({ where: { id }, include: { claimedBy: { select: { userId: true } } } });
  if (!d) throw new AppError(404, 'Donation not found');
  if (d.status !== 'FLAGGED') throw new AppError(409, 'This donation is not flagged');

  const { status, releaseNgo } = statusAfterUnflag(d.statusHistory, d.expiresAt, now);
  const history = [...((d.statusHistory as unknown as HistoryEntry[]) ?? []), { status, at: iso(now), by: 'ADMIN', note: note ?? 'Flag removed' }];
  await prisma.$transaction(async (tx) => {
    const moved = await tx.donation.updateMany({
      where: { id, status: 'FLAGGED', version: d.version },
      data: { status, flagReason: null, version: { increment: 1 }, statusHistory: history as unknown as Prisma.InputJsonValue, ...(releaseNgo && { claimedByNgoId: null }) },
    });
    if (moved.count !== 1) throw new AppError(409, 'This donation was just updated by someone else. Refresh and try again.');
    await audit(tx, admin.id, 'DONATION_UNFLAGGED', 'DONATION', id, { restoredTo: status, note: note ?? null });
  });
  const at = iso(now);
  emitDonationEvent('donation:status', { donationId: id, foodName: d.foodName, status, previousStatus: 'FLAGGED', at }, { userIds: [d.donorId, d.claimedBy?.userId] });
  if (status === 'POSTED') emitDonationEvent('donation:availability', { donationId: id, status, available: true, at }, { toNgos: true });
  return getDonationDetail(id);
}

// ------------------------------------------------------------------ complaints
const complaintInclude = {
  user: { select: { id: true, name: true, email: true, role: true } },
  order: { select: { id: true, orderNumber: true, status: true, total: true } },
  donation: { select: { id: true, foodName: true, status: true } },
} satisfies Prisma.ComplaintInclude;

export async function listComplaints(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.ComplaintWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.q) where.OR = [{ subject: contains(query.q) }, { details: contains(query.q) }, { user: { email: contains(query.q) } }];
  const [total, rows] = await Promise.all([
    prisma.complaint.count({ where }),
    // oldest unresolved first is what a support queue wants; closed ones sort after
    prisma.complaint.findMany({ where, include: complaintInclude, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows, meta: pageMeta(total, p, limit) };
}

export async function getComplaint(id: string) {
  const c = await prisma.complaint.findUnique({ where: { id }, include: complaintInclude });
  if (!c) throw new AppError(404, 'Complaint not found');
  return c;
}

export async function updateComplaint(admin: AuthUser, id: string, body: { status: ComplaintStatus; resolution?: string }) {
  const c = await prisma.complaint.findUnique({ where: { id } });
  if (!c) throw new AppError(404, 'Complaint not found');
  const from = c.status as ComplaintStatus;
  const check = checkComplaintTransition(from, body.status, body.resolution);
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  const closing = body.status === 'RESOLVED' || body.status === 'REJECTED';
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const moved = await tx.complaint.updateMany({
      where: { id, status: from },
      data: { status: body.status, ...(body.resolution && { resolution: body.resolution }), ...(closing && { resolvedAt: now }) },
    });
    if (moved.count !== 1) throw new AppError(409, 'This complaint was just updated by someone else. Refresh and try again.');
    await audit(tx, admin.id, `COMPLAINT_${body.status}`, 'COMPLAINT', id, { from, resolution: body.resolution ?? null });
  });
  emitToUser(c.userId, 'complaint:status', { complaintId: id, status: body.status, resolution: body.resolution ?? null, at: iso(now) });
  return getComplaint(id);
}

// ------------------------------------------------------------------ audit log
export async function listAuditLogs(query: any) {
  const { page: p, limit, skip, take } = page(query);
  const where: Prisma.AuditLogWhereInput = {};
  if (query.entityType) where.entityType = query.entityType;
  if (query.adminId) where.adminId = query.adminId;
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, include: { admin: { select: { id: true, name: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows, meta: pageMeta(total, p, limit) };
}

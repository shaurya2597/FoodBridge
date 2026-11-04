import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { getPagination, pageMeta } from '../utils/pagination';
import { AuthUser } from '../middleware/auth';
import { emitDonationEvent } from '../sockets/donationEvents';
import { validateDonationTiming } from './rules/donationRules';
import { ACTIVE_DONATION_STATUSES, DonationActor, DonationStatus, checkDonationTransition } from './rules/donationStateMachine';
import { DonationViewer, toDonationView } from './rules/donationView';

const MAX_ACTIVE_PER_DONOR = 20;
const iso = (d: Date) => d.toISOString();

interface HistoryEntry { status: string; at: string; by: string; note?: string }

async function ngoOf(user: AuthUser | undefined) {
  if (!user || user.role !== 'NGO') return null;
  return prisma.nGOProfile.findUnique({ where: { userId: user.id } });
}

export async function requireVerifiedNgo(user: AuthUser) {
  const ngo = await ngoOf(user);
  if (!ngo) throw new AppError(403, 'No NGO profile found for this account');
  if (!ngo.isVerified) throw new AppError(403, 'Your NGO has not been verified yet. An administrator must verify it before you can claim donations.');
  return ngo;
}

const withClaimant = { claimedBy: { select: { id: true, userId: true, orgName: true, serviceCity: true, isVerified: true, contactPhone: true, contactEmail: true } } } satisfies Prisma.DonationInclude;
type DonationWithClaimant = Prisma.DonationGetPayload<{ include: typeof withClaimant }>;

function viewerFor(user: AuthUser | undefined, d: DonationWithClaimant, ngo: { id: string; isVerified: boolean } | null): DonationViewer {
  if (user?.role === 'ADMIN') return 'ADMIN';
  if (user && user.id === d.donorId) return 'DONOR';
  if (ngo && d.claimedByNgoId === ngo.id) return 'CLAIMANT';
  if (ngo?.isVerified) return 'NGO';
  return 'PUBLIC';
}

/** What a donor/admin may learn about the NGO holding the donation (contact details only after acceptance). */
function claimantFor(d: DonationWithClaimant) {
  if (!d.claimedBy) return null;
  const revealed = ['ACCEPTED', 'PICKUP_SCHEDULED', 'COLLECTED', 'DISTRIBUTED'].includes(d.status);
  const { id, orgName, serviceCity, isVerified, contactPhone, contactEmail } = d.claimedBy;
  return { id, orgName, serviceCity, isVerified, ...(revealed && { contactPhone, contactEmail }) };
}

function present(d: DonationWithClaimant, viewer: DonationViewer, now: Date, extras: object = {}) {
  const withNgo = viewer === 'DONOR' || viewer === 'ADMIN' ? { claimedBy: claimantFor(d), ...extras } : undefined;
  return toDonationView(d, viewer, now, withNgo);
}

/** A donation is visible to the general audience only while it is open and still safe. */
const isOpenToAll = (d: { status: string; expiresAt: Date }, now: Date) => d.status === 'POSTED' && d.expiresAt.getTime() > now.getTime();

// ---------------------------------------------------------------- create
export async function createDonation(user: AuthUser, input: any) {
  const now = new Date();
  let donorType: 'INDIVIDUAL' | 'RESTAURANT' = 'INDIVIDUAL';
  let donorName = user.name;
  let restaurantId: string | null = null;

  if (user.role === 'RESTAURANT_OWNER') {
    if (!input.restaurantId) throw new AppError(400, 'restaurantId is required when donating as a restaurant');
    const r = await prisma.restaurant.findFirst({ where: { id: input.restaurantId, ownerId: user.id, status: 'APPROVED' } });
    if (!r) throw new AppError(403, 'You can only donate on behalf of your own approved restaurant');
    donorType = 'RESTAURANT'; donorName = r.name; restaurantId = r.id;
  } else if (input.restaurantId) {
    throw new AppError(400, 'Only restaurant owners can donate on behalf of a restaurant');
  }

  const problems = validateDonationTiming({ category: input.category, preparedAt: input.preparedAt, expiresAt: input.expiresAt, now });
  if (problems.length) throw new AppError(400, 'Food safety check failed', { errors: problems });

  const active = await prisma.donation.count({ where: { donorId: user.id, status: { in: ACTIVE_DONATION_STATUSES } } });
  if (active >= MAX_ACTIVE_PER_DONOR) throw new AppError(409, `You already have ${MAX_ACTIVE_PER_DONOR} active donations. Wait for some to be collected first.`);

  const { restaurantId: _ignored, ...data } = input;
  const created = await prisma.donation.create({
    data: {
      ...data, donorId: user.id, donorName, donorType, restaurantId, status: 'POSTED',
      statusHistory: [{ status: 'POSTED', at: iso(now), by: 'DONOR' }] as unknown as Prisma.InputJsonValue,
    },
    include: withClaimant,
  });

  const at = iso(now);
  emitDonationEvent('donation:posted', { donationId: created.id, foodName: created.foodName, status: 'POSTED', available: true, at }, { toNgos: true });
  emitDonationEvent('donation:status', { donationId: created.id, foodName: created.foodName, status: 'POSTED', at }, { userIds: [user.id] });
  return present(created, 'DONOR', now);
}

// ---------------------------------------------------------------- read
export async function listDonations(user: AuthUser | undefined, query: any) {
  const now = new Date();
  const { page, limit, skip, take } = getPagination(query);
  const ngo = await ngoOf(user);
  const where: Prisma.DonationWhereInput = {};

  if (user?.role === 'ADMIN') {
    if (query.status) where.status = query.status;
  } else if (query.mine === 'true') {
    if (!user) throw new AppError(401, 'Authentication required');
    if (user.role === 'NGO') where.claimedByNgoId = ngo?.id ?? '__none__';
    else where.donorId = user.id;
    if (query.status) where.status = query.status;
  } else {
    where.status = 'POSTED'; // everyone else browses open donations only
    where.expiresAt = { gt: now };
  }
  if (query.city) where.city = { equals: query.city, mode: 'insensitive' };
  if (query.foodType) where.foodType = query.foodType;
  if (query.q) where.foodName = { contains: query.q, mode: 'insensitive' };

  const orderBy: Prisma.DonationOrderByWithRelationInput[] =
    query.sort === 'newest' ? [{ createdAt: 'desc' }, { id: 'asc' }] : [{ expiresAt: 'asc' }, { id: 'asc' }];

  const [total, rows] = await Promise.all([
    prisma.donation.count({ where }),
    prisma.donation.findMany({ where, include: withClaimant, orderBy, skip, take }),
  ]);
  return { data: rows.map((d) => present(d, viewerFor(user, d, ngo), now)), meta: pageMeta(total, page, limit) };
}

export async function getDonation(user: AuthUser | undefined, id: string) {
  const now = new Date();
  const d = await prisma.donation.findUnique({ where: { id }, include: withClaimant });
  const ngo = await ngoOf(user);
  if (!d) throw new AppError(404, 'Donation not found');
  const viewer = viewerFor(user, d, ngo);
  // Same 404 for "missing" and "not for you", so ids cannot be probed.
  if (!['ADMIN', 'DONOR', 'CLAIMANT'].includes(viewer) && !isOpenToAll(d, now)) throw new AppError(404, 'Donation not found');

  let extras = {};
  if (viewer === 'DONOR' || viewer === 'ADMIN') {
    const requests = await prisma.donationRequest.findMany({
      where: { donationId: d.id }, orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, message: true, createdAt: true, ngo: { select: { id: true, orgName: true, serviceCity: true } } },
    });
    extras = { requests };
  }
  return present(d, viewer, now, extras);
}

// ---------------------------------------------------------------- NGO request (the atomic claim)
export async function requestDonation(user: AuthUser, id: string, message?: string) {
  const ngo = await requireVerifiedNgo(user);
  const now = new Date();

  const previous = await prisma.donationRequest.findUnique({ where: { donationId_ngoId: { donationId: id, ngoId: ngo.id } } });
  if (previous?.status === 'REJECTED') throw new AppError(409, 'The donor declined your earlier request for this donation');

  const result = await prisma.$transaction(async (tx) => {
    const d = await tx.donation.findUnique({ where: { id } });
    if (!d) throw new AppError(404, 'Donation not found');
    if (d.status !== 'POSTED' || d.expiresAt.getTime() <= now.getTime()) {
      throw new AppError(409, d.expiresAt.getTime() <= now.getTime()
        ? 'This donation has expired' : 'This donation is no longer available: another NGO has already requested it');
    }
    const history = [...((d.statusHistory as unknown as HistoryEntry[]) ?? []), { status: 'NGO_REQUESTED', at: iso(now), by: 'NGO', note: ngo.orgName }];

    // THE claim. Succeeds for exactly one caller: the row must still be POSTED, unclaimed, unexpired and at the
    // version we just read. Two NGOs racing here cannot both get count === 1.
    const claimed = await tx.donation.updateMany({
      where: { id, status: 'POSTED', claimedByNgoId: null, version: d.version, expiresAt: { gt: now } },
      data: { status: 'NGO_REQUESTED', claimedByNgoId: ngo.id, version: { increment: 1 }, statusHistory: history as unknown as Prisma.InputJsonValue },
    });
    if (claimed.count !== 1) throw new AppError(409, 'This donation was just requested by another NGO');

    await tx.donationRequest.upsert({
      where: { donationId_ngoId: { donationId: id, ngoId: ngo.id } },
      update: { status: 'PENDING', message: message || null },
      create: { donationId: id, ngoId: ngo.id, message: message || null, status: 'PENDING' },
    });
    return d;
  });

  const at = iso(now);
  emitDonationEvent('donation:status', { donationId: id, foodName: result.foodName, status: 'NGO_REQUESTED', previousStatus: 'POSTED', at }, { userIds: [result.donorId, user.id] });
  emitDonationEvent('donation:availability', { donationId: id, status: 'NGO_REQUESTED', available: false, at }, { toNgos: true });
  return getDonation(user, id);
}

// ---------------------------------------------------------------- status changes
export async function changeDonationStatus(user: AuthUser, id: string, body: { status: DonationStatus; pickupAt?: Date; reason?: string }) {
  const now = new Date();
  const d = await prisma.donation.findUnique({ where: { id }, include: withClaimant });
  const ngo = await ngoOf(user);

  let actor: DonationActor | null = null;
  if (user.id === d?.donorId && user.role !== 'ADMIN') actor = 'DONOR';
  else if (d && ngo && d.claimedByNgoId === ngo.id) actor = 'NGO';
  if (!d || !actor) throw new AppError(404, 'Donation not found'); // strangers (and admins, in Phase 3) cannot change it

  const from = d.status as DonationStatus;
  const check = checkDonationTransition({ from, to: body.status, actor, now, expiresAt: d.expiresAt, pickupAt: body.pickupAt });
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  // Going back to the pool after the food has expired means it is simply expired.
  const releasing = body.status === 'POSTED';
  const effective: DonationStatus = releasing && d.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : body.status;
  const claimantUserId = d.claimedBy?.userId ?? null;

  const history = [...((d.statusHistory as unknown as HistoryEntry[]) ?? []), { status: effective, at: iso(now), by: actor, ...(body.reason && { note: body.reason }) }];

  await prisma.$transaction(async (tx) => {
    const moved = await tx.donation.updateMany({
      where: { id, status: from, version: d.version }, // optimistic lock: nobody changed it since we read it
      data: {
        status: effective, version: { increment: 1 }, statusHistory: history as unknown as Prisma.InputJsonValue,
        ...(releasing && { claimedByNgoId: null }),
        ...(effective === 'PICKUP_SCHEDULED' && { pickupScheduledAt: body.pickupAt }),
      },
    });
    if (moved.count !== 1) throw new AppError(409, 'This donation was just updated by someone else. Refresh and try again.');

    if (d.claimedByNgoId) {
      const ngoId = d.claimedByNgoId;
      if (effective === 'ACCEPTED') await tx.donationRequest.updateMany({ where: { donationId: id, ngoId, status: 'PENDING' }, data: { status: 'APPROVED' } });
      else if (releasing) await tx.donationRequest.updateMany({ where: { donationId: id, ngoId, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: actor === 'NGO' ? 'WITHDRAWN' : 'REJECTED' } });
      else if (effective === 'CANCELLED') await tx.donationRequest.updateMany({ where: { donationId: id, ngoId, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: 'REJECTED' } });
    }
  });

  const at = iso(now);
  emitDonationEvent('donation:status', {
    donationId: id, foodName: d.foodName, status: effective, previousStatus: from,
    pickupScheduledAt: body.pickupAt ? iso(body.pickupAt) : d.pickupScheduledAt ? iso(d.pickupScheduledAt) : null, at,
  }, { userIds: [d.donorId, claimantUserId] });
  if (effective === 'POSTED') emitDonationEvent('donation:availability', { donationId: id, status: 'POSTED', available: true, at }, { toNgos: true });
  if (from === 'POSTED' && effective === 'CANCELLED') emitDonationEvent('donation:availability', { donationId: id, status: 'CANCELLED', available: false, at }, { toNgos: true });

  // A withdrawing NGO may no longer be allowed to see the donation (e.g. it just expired): confirm the change anyway.
  return getDonation(user, id).catch((e) => { if (e instanceof AppError && e.statusCode === 404) return { id, status: effective }; throw e; });
}

// ---------------------------------------------------------------- expiry sweep
/**
 * Marks donations whose consume-before time has passed as EXPIRED and releases any NGO claim on them.
 * Correctness never depends on this running: listings and transitions check expiry themselves.
 * This just keeps stored statuses honest. Safe to run repeatedly and from several processes.
 */
export async function expireStaleDonations(now = new Date()): Promise<number> {
  const stale = await prisma.donation.findMany({
    where: { status: { in: ACTIVE_DONATION_STATUSES }, expiresAt: { lte: now } },
    include: { claimedBy: { select: { userId: true } } }, take: 200,
  });
  let expired = 0;
  for (const d of stale) {
    const history = [...((d.statusHistory as unknown as HistoryEntry[]) ?? []), { status: 'EXPIRED', at: iso(now), by: 'SYSTEM' }];
    const done = await prisma.$transaction(async (tx) => {
      const moved = await tx.donation.updateMany({
        where: { id: d.id, status: d.status, version: d.version },
        data: { status: 'EXPIRED', version: { increment: 1 }, statusHistory: history as unknown as Prisma.InputJsonValue },
      });
      if (moved.count !== 1) return false; // someone else changed it first; the next sweep will look again
      await tx.donationRequest.updateMany({ where: { donationId: d.id, status: { in: ['PENDING', 'APPROVED'] } }, data: { status: 'REJECTED' } });
      return true;
    });
    if (!done) continue;
    expired++;
    const at = iso(now);
    emitDonationEvent('donation:status', { donationId: d.id, foodName: d.foodName, status: 'EXPIRED', previousStatus: d.status, at }, { userIds: [d.donorId, d.claimedBy?.userId] });
    emitDonationEvent('donation:availability', { donationId: d.id, status: 'EXPIRED', available: false, at }, { toNgos: true });
  }
  return expired;
}

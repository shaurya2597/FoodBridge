import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { getPagination, pageMeta } from '../utils/pagination';
import { AuthUser } from '../middleware/auth';
import { emitAssistanceEvent } from '../sockets/donationEvents';
import { AssistanceActor, AssistanceStatus, checkAssistanceTransition } from './rules/assistanceRules';
import { AssistanceViewer, toAssistanceView } from './rules/donationView';
import { requireVerifiedNgo } from './donationService';

const MAX_OPEN_PER_PHONE = 3;
const iso = (d: Date) => d.toISOString();
interface HistoryEntry { status: string; at: string; by: string; note?: string }
const include = { assignedNgo: { select: { id: true, userId: true, orgName: true } } } satisfies Prisma.FoodAssistanceRequestInclude;

/** Anyone may ask for help: logged in or not. Anonymous requests can be followed with the returned id. */
export async function createAssistance(user: AuthUser | undefined, input: any) {
  const open = await prisma.foodAssistanceRequest.count({ where: { phone: input.phone, status: { in: ['OPEN', 'ASSIGNED'] } } });
  if (open >= MAX_OPEN_PER_PHONE) throw new AppError(429, 'This phone number already has several open requests. Please wait for them to be handled.');

  const now = new Date();
  const created = await prisma.foodAssistanceRequest.create({
    data: {
      userId: user?.id ?? null, name: input.name, phone: input.phone, people: input.people,
      requirement: input.requirements.join(', '), foodType: input.foodType ?? null,
      location: input.location, city: input.city, notes: input.notes || null,
      statusHistory: [{ status: 'OPEN', at: iso(now), by: 'REQUESTER' }] as unknown as Prisma.InputJsonValue,
    },
    include,
  });
  emitAssistanceEvent('assistance:new', { requestId: created.id, status: 'OPEN', city: created.city, at: iso(now) }, { toNgos: true, userIds: [user?.id] });
  return {
    ...toAssistanceView(created, 'OWNER', null),
    // Shown once so anonymous requesters can follow progress without an account.
    trackingUrl: `/api/assistance/${created.id}`,
  };
}

async function ngoFor(user: AuthUser | undefined) {
  if (!user || user.role !== 'NGO') return null;
  return prisma.nGOProfile.findUnique({ where: { userId: user.id } });
}

export async function listAssistance(user: AuthUser, query: any) {
  const { page, limit, skip, take } = getPagination(query);
  const where: Prisma.FoodAssistanceRequestWhereInput = {};
  let viewer: AssistanceViewer = 'OWNER';

  if (user.role === 'ADMIN') {
    viewer = 'ADMIN';
    if (query.status) where.status = query.status;
  } else if (user.role === 'NGO') {
    const ngo = await requireVerifiedNgo(user);
    if (query.mine === 'true') {
      where.assignedNgoId = ngo.id; viewer = 'ASSIGNED_NGO';
      if (query.status) where.status = query.status;
    } else {
      where.status = 'OPEN'; viewer = 'NGO_BROWSE';
      where.city = { equals: query.city ?? ngo.serviceCity, mode: 'insensitive' }; // defaults to the NGO's own service city
    }
  } else {
    where.userId = user.id; // everyone else sees only the requests they made
    if (query.status) where.status = query.status;
  }

  const [total, rows] = await Promise.all([
    prisma.foodAssistanceRequest.count({ where }),
    prisma.foodAssistanceRequest.findMany({ where, include, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows.map((r) => toAssistanceView(r, viewer, r.assignedNgo?.orgName)), meta: pageMeta(total, page, limit) };
}

export async function getAssistance(user: AuthUser | undefined, id: string) {
  const r = await prisma.foodAssistanceRequest.findUnique({ where: { id }, include });
  if (!r) throw new AppError(404, 'Request not found');
  const ngo = await ngoFor(user);

  let viewer: AssistanceViewer = 'TRACKER'; // an anonymous caller who knows the id
  if (user?.role === 'ADMIN') viewer = 'ADMIN';
  else if (user && r.userId === user.id) viewer = 'OWNER';
  else if (ngo && r.assignedNgoId === ngo.id) viewer = 'ASSIGNED_NGO';
  else if (ngo?.isVerified && r.status === 'OPEN') viewer = 'NGO_BROWSE';
  return toAssistanceView(r, viewer, r.assignedNgo?.orgName);
}

export async function changeAssistanceStatus(user: AuthUser, id: string, to: AssistanceStatus, note?: string) {
  const r = await prisma.foodAssistanceRequest.findUnique({ where: { id }, include });
  if (!r) throw new AppError(404, 'Request not found');

  let actor: AssistanceActor;
  let ngoId: string | null = null;
  if (user.role === 'NGO') {
    const ngo = await requireVerifiedNgo(user);
    // Taking an OPEN request is open to any verified NGO; every later step belongs to the assigned NGO only.
    if (r.status !== 'OPEN' && r.assignedNgoId !== ngo.id) throw new AppError(404, 'Request not found');
    actor = 'NGO'; ngoId = ngo.id;
  } else if (r.userId && r.userId === user.id) {
    actor = 'REQUESTER';
  } else {
    throw new AppError(404, 'Request not found'); // includes admins in Phase 3 (moderation arrives in Phase 4)
  }

  const from = r.status as AssistanceStatus;
  const check = checkAssistanceTransition(from, to, actor);
  if (!check.ok) throw new AppError(check.httpStatus, check.message);

  const now = new Date();
  const history = [...((r.statusHistory as unknown as HistoryEntry[]) ?? []), { status: to, at: iso(now), by: actor, ...(note && { note }) }];
  const moved = await prisma.foodAssistanceRequest.updateMany({
    // Conditional on the status we validated, so two NGOs taking the same request cannot both succeed.
    where: { id, status: from, ...(from === 'OPEN' ? { assignedNgoId: null } : { assignedNgoId: r.assignedNgoId }) },
    data: {
      status: to, statusHistory: history as unknown as Prisma.InputJsonValue,
      ...(to === 'ASSIGNED' && { assignedNgoId: ngoId }),
      ...(to === 'OPEN' && { assignedNgoId: null }),
    },
  });
  if (moved.count !== 1) throw new AppError(409, 'This request was just taken or updated by someone else');

  emitAssistanceEvent('assistance:status', { requestId: id, status: to, city: r.city, at: iso(now) }, {
    userIds: [r.userId, r.assignedNgo?.userId, user.id], toNgos: to === 'OPEN' || to === 'CLOSED',
  });
  return getAssistance(user, id);
}

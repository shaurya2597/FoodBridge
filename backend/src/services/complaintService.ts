import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { getPagination, pageMeta } from '../utils/pagination';
import { AuthUser } from '../middleware/auth';
import { getOrder } from './orderService';
import { getDonation } from './donationService';

const view = (c: any) => ({
  id: c.id, category: c.category, subject: c.subject, details: c.details, status: c.status, resolution: c.resolution,
  orderId: c.orderId, donationId: c.donationId, createdAt: c.createdAt, resolvedAt: c.resolvedAt,
});

export async function createComplaint(user: AuthUser, input: { category: string; subject: string; details: string; orderId?: string; donationId?: string }) {
  // The linked order/donation must be one this person is allowed to see; otherwise it looks like it does not exist.
  if (input.orderId) await getOrder(user, input.orderId);
  if (input.donationId) await getDonation(user, input.donationId);

  const open = await prisma.complaint.count({ where: { userId: user.id, status: { in: ['OPEN', 'IN_REVIEW'] } } });
  if (open >= 10) throw new AppError(429, 'You already have 10 complaints under review. Please wait for them to be handled.');

  return view(await prisma.complaint.create({ data: { userId: user.id, ...input } }));
}

export async function listMyComplaints(user: AuthUser, query: { status?: any; page?: unknown; limit?: unknown }) {
  const { page, limit, skip, take } = getPagination(query);
  const where = { userId: user.id, ...(query.status && { status: query.status }) };
  const [total, rows] = await Promise.all([
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip, take }),
  ]);
  return { data: rows.map(view), meta: pageMeta(total, page, limit) };
}

export async function getMyComplaint(user: AuthUser, id: string) {
  const c = await prisma.complaint.findFirst({ where: { id, userId: user.id } }); // someone else's complaint is a 404
  if (!c) throw new AppError(404, 'Complaint not found');
  return view(c);
}

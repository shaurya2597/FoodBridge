import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { AuthUser } from '../middleware/auth';

export async function getProfile(user: AuthUser) {
  const p = await prisma.nGOProfile.findUnique({ where: { userId: user.id } });
  if (!p) throw new AppError(404, 'NGO profile not found');
  return p;
}

export async function updateProfile(user: AuthUser, patch: Record<string, unknown>) {
  await getProfile(user);
  return prisma.nGOProfile.update({ where: { userId: user.id }, data: patch });
}

/** Collection and donation counts for the NGO dashboard. */
export async function getNgoSummary(user: AuthUser) {
  const profile = await getProfile(user);
  const [byStatus, servings] = await Promise.all([
    prisma.donation.groupBy({ by: ['status'], where: { claimedByNgoId: profile.id }, _count: { _all: true } }),
    prisma.donation.aggregate({ where: { claimedByNgoId: profile.id, status: { in: ['COLLECTED', 'DISTRIBUTED'] } }, _sum: { servings: true } }),
  ]);
  return {
    profile,
    donationsByStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
    servingsCollected: servings._sum.servings ?? 0,
  };
}

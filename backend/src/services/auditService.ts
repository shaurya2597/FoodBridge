import { Prisma } from '@prisma/client';

export type AuditEntity = 'USER' | 'RESTAURANT' | 'NGO' | 'DONATION' | 'COMPLAINT';

/** Records who did what. Always called inside the same transaction as the change it describes. */
export function audit(tx: Prisma.TransactionClient, adminId: string, action: string, entityType: AuditEntity, entityId: string, details?: Record<string, unknown>) {
  return tx.auditLog.create({ data: { adminId, action, entityType, entityId, details: (details ?? undefined) as Prisma.InputJsonValue | undefined } });
}

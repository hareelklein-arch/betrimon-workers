import { prisma } from "@/lib/db";

export async function writeAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        before: params.before == null ? null : JSON.stringify(params.before),
        after: params.after == null ? null : JSON.stringify(params.after),
      },
    });
  } catch (error) {
    console.error("writeAudit", error);
  }
}

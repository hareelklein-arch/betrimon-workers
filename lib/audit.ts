import { prisma } from "@/lib/db";
import { afterResponse } from "@/lib/background";

export async function writeAudit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  afterResponse(async () => {
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
  });
}

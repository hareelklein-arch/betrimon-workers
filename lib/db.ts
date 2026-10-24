import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function postgresPoolUrl(url: string) {
  if (!/^postgres(ql)?:\/\//i.test(url)) return url;
  const hashIndex = url.indexOf("#");
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  let base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const params: string[] = [];
  if (!/[?&]pgbouncer=/i.test(base)) params.push("pgbouncer=true");
  if (!/[?&]connection_limit=/i.test(base)) params.push("connection_limit=1");
  if (!/[?&]sslmode=/i.test(base)) params.push("sslmode=require");
  if (params.length === 0) return url;
  base += (base.includes("?") ? "&" : "?") + params.join("&");
  return base + hash;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: postgresPoolUrl(process.env.DATABASE_URL || ""),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function appendParam(url: string, key: string, value: string) {
  return url + (url.includes("?") ? "&" : "?") + `${key}=${value}`;
}

function postgresPoolUrl(url: string) {
  if (!/^postgres(ql)?:\/\//i.test(url)) return url;
  const hashIndex = url.indexOf("#");
  const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
  let base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  if (!/[?&]pgbouncer=/i.test(base)) base = appendParam(base, "pgbouncer", "true");
  if (!/[?&]sslmode=/i.test(base)) base = appendParam(base, "sslmode", "require");
  if (!/[?&]pool_timeout=/i.test(base)) base = appendParam(base, "pool_timeout", "20");
  if (/[?&]connection_limit=1(?:&|$)/i.test(base)) {
    base = base.replace(/([?&]connection_limit=)1(?=&|$)/i, "$15");
  } else if (!/[?&]connection_limit=/i.test(base)) {
    base = appendParam(base, "connection_limit", "5");
  }
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

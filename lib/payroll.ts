import { ageOn } from "@/lib/format";
import { prisma } from "@/lib/db";

type RateContext = {
  userId: string;
  jobTypeId: string;
  workDate: Date;
  birthDate?: Date | null;
  personalRate?: number | null;
};

export function resolveHourlyRate(
  ctx: RateContext,
  rates: {
    userId: string | null;
    jobTypeId: string | null;
    minAge: number | null;
    maxAge: number | null;
    hourlyRate: number;
    active: boolean;
  }[],
) {
  if (ctx.personalRate && ctx.personalRate > 0) {
    return ctx.personalRate;
  }

  const age = ctx.birthDate ? ageOn(ctx.birthDate, ctx.workDate) : null;
  const active = rates.filter((rate) => rate.active);

  const personal = active.find((rate) => rate.userId === ctx.userId && (!rate.jobTypeId || rate.jobTypeId === ctx.jobTypeId));
  if (personal) {
    return personal.hourlyRate;
  }

  const byJobAndAge = active.find((rate) => {
    if (rate.userId || rate.jobTypeId !== ctx.jobTypeId) return false;
    if (age === null) return rate.minAge == null && rate.maxAge == null;
    if (rate.minAge != null && age < rate.minAge) return false;
    if (rate.maxAge != null && age > rate.maxAge) return false;
    return rate.minAge != null || rate.maxAge != null;
  });
  if (byJobAndAge) {
    return byJobAndAge.hourlyRate;
  }

  const byJob = active.find((rate) => !rate.userId && rate.jobTypeId === ctx.jobTypeId && rate.minAge == null && rate.maxAge == null);
  if (byJob) {
    return byJob.hourlyRate;
  }

  const byAge = active.find((rate) => {
    if (rate.userId || rate.jobTypeId) return false;
    if (age === null) return false;
    if (rate.minAge != null && age < rate.minAge) return false;
    if (rate.maxAge != null && age > rate.maxAge) return false;
    return true;
  });
  if (byAge) {
    return byAge.hourlyRate;
  }

  return 32;
}

export async function rateForWorker(userId: string, jobTypeId: string, workDate: Date) {
  const [profile, rates] = await Promise.all([
    prisma.workerProfile.findUnique({ where: { userId } }),
    prisma.payRate.findMany({ where: { active: true } }),
  ]);

  return resolveHourlyRate(
    {
      userId,
      jobTypeId,
      workDate,
      birthDate: profile?.birthDate,
      personalRate: profile?.personalRate,
    },
    rates,
  );
}

export function hoursBetween(startsAt: Date | null | undefined, endsAt: Date | null | undefined) {
  if (!startsAt || !endsAt) return 0;
  return Math.round(((endsAt.getTime() - startsAt.getTime()) / 36e5) * 100) / 100;
}

export function payAmount(hours: number, hourlyRate: number) {
  return Math.round(hours * hourlyRate * 100) / 100;
}

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageTitle } from "@/components/shell";
import { TimeEntryForm } from "@/components/forms";
import { toDateInput, toTimeInput } from "@/lib/format";
import { formatShiftDate, shiftDay } from "@/lib/shift";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ shiftId?: string }> }) {
  const user = await requireUser();
  const { shiftId } = await searchParams;
  if (!shiftId) {
    redirect("/worker");
  }

  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { site: true, jobType: true },
  });

  if (!shift || (user.role !== "manager" && shift.userId !== user.id) || shift.status === "cancelled") {
    notFound();
  }

  return (
    <>
      <PageTitle title="דיווח שעות" subtitle="מדווחים על השיבוץ שנבחר. אי אפשר לשנות מקום או משמרת." />
      <TimeEntryForm
        shift={{
          id: shift.id,
          label: `${formatShiftDate(shift)} · ${shift.jobType.name} · ${shift.site.name}`,
          siteId: shift.siteId,
          siteName: shift.site.name,
          jobTypeId: shift.jobTypeId,
          jobName: shift.jobType.name,
          workDate: toDateInput(shiftDay(shift)),
          dateLabel: formatShiftDate(shift),
          startTime: shift.startsAt ? toTimeInput(shift.startsAt) : undefined,
          endTime: shift.endsAt ? toTimeInput(shift.endsAt) : undefined,
        }}
      />
    </>
  );
}

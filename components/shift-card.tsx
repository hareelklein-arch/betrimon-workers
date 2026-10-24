import Link from "next/link";
import { StatusBadge } from "@/components/shell";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] py-2 first:border-t-0">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="font-bold">{children}</span>
    </div>
  );
}

export function ShiftAssignmentCard({
  href,
  jobName,
  siteName,
  dateLabel,
  startTime,
  endTime,
  hours,
  status,
  isNew,
  notes,
  trainee,
}: {
  href: string;
  jobName: string;
  siteName: string;
  dateLabel: string;
  startTime?: string | null;
  endTime?: string | null;
  hours?: number | null;
  status: string;
  isNew?: boolean;
  notes?: string | null;
  trainee?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`card block p-4 transition hover:border-[var(--primary)] ${isNew ? "border-[var(--primary)]" : ""}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {isNew ? <p className="mb-1 text-sm font-bold text-[var(--ok)]">שיבוץ חדש</p> : null}
          <h3 className="text-xl font-black">{jobName}</h3>
          <p className="text-[var(--muted)]">{siteName}</p>
          {trainee ? <p className="mt-1 text-sm font-bold text-[var(--accent)]">מתלמד/ת</p> : null}
        </div>
        <StatusBadge status={status} />
      </div>
      <Fact label="תאריך">{dateLabel}</Fact>
      <Fact label="שעות">
        {startTime && endTime ? (
          <span>
            {startTime} – {endTime}
          </span>
        ) : (
          "בתיאום בצ'אט"
        )}
      </Fact>
      <Fact label="משך">
        {hours != null ? (
          <>
            שעות <span dir="ltr">{hours.toLocaleString("he-IL", { maximumFractionDigits: 2 })}</span>
          </>
        ) : (
          "עדיין לא נקבע"
        )}
      </Fact>
      {notes ? <p className="mt-2 text-sm text-[var(--muted)]">{notes}</p> : null}
      <p className="mt-3 text-sm font-bold text-[var(--primary)]">לחצו לפרטים</p>
    </Link>
  );
}

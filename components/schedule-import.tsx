"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { importScheduleAction } from "@/lib/actions";
import { toDateInput } from "@/lib/format";
import { PleaseWait, waitLabel } from "@/components/please-wait";

export function ScheduleImportForm({
  sites,
  jobs,
  workers,
}: {
  sites: { name: string }[];
  jobs: { name: string }[];
  workers: { name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  function downloadTemplate() {
    const csv = templateCsv({
      date: toDateInput(new Date()),
      job: jobs[0]?.name || "ניקיון",
      site: sites[0]?.name || "אולם התרבות",
      workers: workers.slice(0, 2).map((worker) => worker.name).join(", ") || "שם עובד",
      trainees: workers[2]?.name || "",
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "תבנית-שיבוץ.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <form
      className="card grid gap-3 p-4"
      action={(formData) => {
        if (pending) return;
        start(async () => {
          const result = await importScheduleAction(formData);
          setWarnings(result.warnings ?? []);
          if (!result.ok) {
            setError(result.error);
            setMessage("");
            return;
          }
          setError("");
          setMessage(
            result.jobs === 1
              ? `שובצו ${result.assigned} עובדים לעבודה אחת.`
              : `שובצו ${result.assigned} עובדים ב-${result.jobs} עבודות.`,
          );
          router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-lg font-extrabold">העלאת טבלת שיבוץ</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          הורידו תבנית, מלאו תאריך, סוג עבודה, מקום ושמות עובדים, והעלו. המערכת משבצת לפי השמות בטבלה. אפשר CSV או
          אקסל. כמה שמות באותה עמודה מופרדים בפסיק.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={downloadTemplate}>
          הורדת תבנית
        </button>
        <label className="field min-w-56 flex-1">
          <span>קובץ טבלה</span>
          <input type="file" name="file" accept=".csv,.txt,.xlsx,.xls" required />
        </label>
      </div>
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      {message ? <p className="text-sm font-bold text-[var(--ok)]">{message}</p> : null}
      {warnings.length > 0 ? (
        <ul className="grid gap-1 text-sm text-[var(--muted)]">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <PleaseWait show={pending} />
      <button className="btn" disabled={pending}>
        {waitLabel(pending, "שבץ לפי הטבלה")}
      </button>
    </form>
  );
}

function templateCsv(sample: { date: string; job: string; site: string; workers: string; trainees: string }) {
  const header = "תאריך,סוג עבודה,מקום,עובדים,מתלמדים";
  const row = [sample.date, sample.job, sample.site, sample.workers, sample.trainees].map(csvCell).join(",");
  return `\uFEFF${header}\n${row}\n`;
}

function csvCell(value: string) {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

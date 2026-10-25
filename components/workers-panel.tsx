"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DeleteWorkerButton, WorkerForm } from "@/components/manager-forms";
import { approveWorkerAction, deleteWorkerAction } from "@/lib/actions";

export type WorkerListItem = {
  id: string;
  name: string;
  username: string;
  phone: string;
  email: string | null;
  role: string;
  active: boolean;
  pendingApproval: boolean;
  profile?: {
    birthDate: Date | string | null;
    parentPhone: string | null;
    paymentMethod: string | null;
    bankDetails: string | null;
    personalRate: number | null;
  } | null;
};

function matchesSearch(user: WorkerListItem, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  const hay = [user.name, user.username, user.email || "", user.phone].join(" ").toLowerCase();
  if (hay.includes(needle)) return true;
  return Boolean(digits) && user.phone.replace(/\D/g, "").includes(digits);
}

export function WorkersPanel({
  users,
  managerId,
  joinToken,
}: {
  users: WorkerListItem[];
  managerId: string;
  joinToken: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [copied, setCopied] = useState("");
  const visible = useMemo(() => users.filter((user) => matchesSearch(user, query)), [users, query]);
  const pending = visible.filter((user) => user.pendingApproval);
  const rest = visible.filter((user) => !user.pendingApproval);

  useEffect(() => {
    if (!openAdd) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenAdd(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openAdd]);

  function joinUrl() {
    return `${window.location.origin}/join?t=${joinToken}`;
  }

  async function copyJoinLink() {
    const url = joinUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied("הקישור הועתק. אפשר לשלוח אותו בקבוצת וואטסאפ.");
    } catch {
      setCopied(url);
    }
  }

  return (
    <section className="grid gap-3">
      <label className="field">
        <span>חיפוש עובד</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="שם, מייל או טלפון"
        />
      </label>

      {pending.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-lg font-extrabold">ממתינים לאישור</h3>
          {pending.map((user) => (
            <PendingWorkerCard key={user.id} user={user} />
          ))}
        </div>
      ) : null}

      {rest.length === 0 && pending.length === 0 ? (
        <p className="text-[var(--muted)]">{query ? "אין עובדים שמתאימים לחיפוש." : "אין עובדים עדיין."}</p>
      ) : (
        rest.map((user) => (
          <details key={user.id} className="card p-4">
            <summary className="cursor-pointer font-extrabold">
              {user.name} · {user.username} {user.active ? "" : "(לא פעיל)"}
            </summary>
            <div className="mt-3 grid gap-3">
              <WorkerForm worker={user} />
              {user.id === managerId ? (
                <p className="text-sm text-[var(--muted)]">אי אפשר למחוק את החשבון שמחוברים אליו.</p>
              ) : (
                <DeleteWorkerButton id={user.id} name={user.name} />
              )}
            </div>
          </details>
        ))
      )}

      <button type="button" className="btn" onClick={() => setOpenAdd(true)}>
        הוספת עובד חדש
      </button>
      <div className="grid gap-2">
        <button type="button" className="btn btn-secondary" onClick={copyJoinLink}>
          העתקת קישור רישום
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            window.open(
              `https://wa.me/?text=${encodeURIComponent(`הרשמה לעבודה בבית רימון:\n${joinUrl()}`)}`,
              "_blank",
              "noopener,noreferrer",
            );
          }}
        >
          שליחה בוואטסאפ
        </button>
        {copied ? <p className="text-sm font-bold text-[var(--ok)]">{copied}</p> : null}
        <p className="text-sm text-[var(--muted)]">מי שנרשם בקישור יופיע כאן לאישור. בלי אישור הוא לא יכול להיכנס.</p>
      </div>

      {openAdd ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="סגירה" onClick={() => setOpenAdd(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-worker-title"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--line)] bg-[var(--card)] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
              <h3 id="add-worker-title" className="text-xl font-black">
                עובד חדש
              </h3>
              <button type="button" className="btn btn-secondary px-3" onClick={() => setOpenAdd(false)}>
                סגירה
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <WorkerForm
                plain
                onSuccess={() => {
                  setOpenAdd(false);
                  router.refresh();
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PendingWorkerCard({ user }: { user: WorkerListItem }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <article className="card grid gap-3 p-4">
      <div>
        <p className="font-extrabold">{user.name}</p>
        <p className="text-sm text-[var(--muted)]">
          {user.username} · {user.phone}
          {user.email ? ` · ${user.email}` : ""}
        </p>
      </div>
      {error ? <p className="text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn"
          disabled={pending}
          onClick={() => {
            const formData = new FormData();
            formData.set("id", user.id);
            start(async () => {
              const result = await approveWorkerAction(formData);
              setError(result.ok ? "" : result.error);
              if (result.ok) router.refresh();
            });
          }}
        >
          אישור
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`לדחות את ${user.name}? החשבון יימחק.`)) return;
            const formData = new FormData();
            formData.set("id", user.id);
            start(async () => {
              const result = await deleteWorkerAction(formData);
              setError(result.ok ? "" : result.error);
              if (result.ok) router.refresh();
            });
          }}
        >
          דחייה
        </button>
      </div>
    </article>
  );
}

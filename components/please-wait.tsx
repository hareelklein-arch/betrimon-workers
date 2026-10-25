"use client";

export function waitLabel(pending: boolean, label: string) {
  return pending ? "אנא המתן…" : label;
}

export function PleaseWait({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-6"
      role="status"
      aria-live="assertive"
      aria-busy="true"
    >
      <div className="rounded-3xl border border-[var(--line)] bg-[var(--card)] px-8 py-5 text-center shadow-2xl">
        <p className="text-xl font-black">אנא המתן…</p>
      </div>
    </div>
  );
}

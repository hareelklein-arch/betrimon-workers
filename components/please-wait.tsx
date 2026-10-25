"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

let waiting = false;
const listeners = new Set<() => void>();
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function beginWait() {
  waiting = true;
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(endWait, 20000);
  emit();
}

export function endWait() {
  waiting = false;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  emit();
}

export function busy(start: (job: () => void) => void, job: () => Promise<void>) {
  beginWait();
  start(async () => {
    try {
      await job();
    } finally {
      setTimeout(endWait, 3000);
    }
  });
}

export function waitLabel(pending: boolean, label: string) {
  return pending ? "אנא המתן…" : label;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function overlay() {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 px-6"
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

export function PleaseWait({ show }: { show: boolean }) {
  useEffect(() => {
    if (show) beginWait();
  }, [show]);
  return null;
}

export function WaitSubmit({
  label,
  className = "btn",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const { pending } = useFormStatus();
  useEffect(() => {
    if (pending) beginWait();
    else endWait();
  }, [pending]);
  return (
    <button className={className} type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? "אנא המתן…" : label}
    </button>
  );
}

export function WaitHost() {
  const show = useSyncExternalStore(subscribe, () => waiting, () => false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    endWait();
  }, [pathname, searchParams]);

  useEffect(() => {
    function onSubmit() {
      beginWait();
    }
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest("a");
      if (link) {
        if (link.hasAttribute("data-no-wait")) return;
        const href = link.getAttribute("href") || "";
        if (link.target === "_blank" || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
        if (href.startsWith("/") || href.startsWith("?")) beginWait();
        return;
      }
      const button = target.closest("button");
      if (!button || button.disabled) return;
      const type = (button.getAttribute("type") || "submit").toLowerCase();
      if (type === "submit") beginWait();
    }
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!show || typeof document === "undefined") return null;
  return createPortal(overlay(), document.body);
}

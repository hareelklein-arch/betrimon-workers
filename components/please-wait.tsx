"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

let waiting = false;
const listeners = new Set<() => void>();
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function beginWait() {
  if (waiting || showTimer) return;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  showTimer = setTimeout(() => {
    showTimer = null;
    waiting = true;
    hideTimer = setTimeout(endWait, 20000);
    emit();
  }, 280);
}

export function endWait() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  waiting = false;
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  emit();
}

export function busy(start: (job: () => void) => void, job: () => Promise<void>) {
  start(job);
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

export function PleaseWait({ show: _show }: { show: boolean }) {
  return null;
}

export function WaitSubmit({
  label,
  className = "btn",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  const { pending } = useFormStatus();
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
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest("a[data-wait]") as HTMLAnchorElement | null;
      if (!link || link.hasAttribute("data-no-wait") || link.target === "_blank") return;
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("/") && !href.startsWith("?")) return;
      try {
        const next = new URL(href, window.location.href);
        if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      } catch {
        return;
      }
      beginWait();
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  if (!show || typeof document === "undefined") return null;
  return createPortal(overlay(), document.body);
}

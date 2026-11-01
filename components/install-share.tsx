"use client";

import { useState } from "react";
import { installUrl, installWhatsAppHref } from "@/lib/install";

export function InstallShare({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState("");

  function origin() {
    return window.location.origin;
  }

  async function copyLink() {
    const url = installUrl(origin());
    try {
      await navigator.clipboard.writeText(url);
      setCopied("הקישור הועתק. שלחו אותו בוואטסאפ.");
    } catch {
      setCopied(url);
    }
  }

  return (
    <section className={compact ? "grid gap-2" : "card grid gap-3 p-4"}>
      {compact ? null : <h3 className="text-lg font-extrabold">קישור התקנה לעובדים</h3>}
      {compact ? null : (
        <p className="text-sm text-[var(--muted)]">
          זה הקישור לשליחה בוואטסאפ. מי שפותח אותו מתקין את האפליקציה למסך הבית.
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="btn" onClick={copyLink}>
          העתקת קישור התקנה
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            window.open(installWhatsAppHref(origin()), "_blank", "noopener,noreferrer");
          }}
        >
          שליחה בוואטסאפ
        </button>
      </div>
      {copied ? <p className="text-sm font-bold text-[var(--ok)]">{copied}</p> : null}
    </section>
  );
}

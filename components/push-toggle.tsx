"use client";

import { useState } from "react";
import { enablePushNotifications } from "@/lib/push-client";

export function PushToggle() {
  const [message, setMessage] = useState("");

  async function enable() {
    const result = await enablePushNotifications();
    setMessage(result.ok ? "התראות לטלפון הופעלו." : result.error);
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
      <button type="button" className="text-sm font-bold text-[var(--primary)]" onClick={enable}>
        הפעלת התראות בטלפון
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}

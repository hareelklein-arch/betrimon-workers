"use client";

import { useEffect, useState } from "react";
import { enablePushNotifications, notificationsAllowed } from "@/lib/push-client";
import { waitLabel } from "@/components/please-wait";

export function PushToggle() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setVisible(!notificationsAllowed());
  }, []);

  if (!visible) return null;

  async function enable() {
    setPending(true);
    const result = await enablePushNotifications();
    setPending(false);
    if (result.ok) {
      setVisible(false);
      return;
    }
    setMessage(result.error);
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
      <button type="button" className="text-sm font-bold text-[var(--primary)]" disabled={pending} onClick={enable}>
        {waitLabel(pending, "הפעלת התראות בטלפון")}
      </button>
      {message ? <span>{message}</span> : null}
    </div>
  );
}

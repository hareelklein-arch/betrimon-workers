"use client";

import { useState } from "react";
import { savePushSubscriptionAction } from "@/lib/actions";

export function PushToggle() {
  const [message, setMessage] = useState("");

  async function enable() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("הדפדפן הזה לא תומך בהתראות.");
      return;
    }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      setMessage("התראות בתוך האפליקציה פעילות. Web Push ידלק אחרי הגדרת מפתחות VAPID.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("לא אושרה הרשאת התראות.");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      setMessage("לא הצלחנו לשמור את ההרשאה.");
      return;
    }
    await savePushSubscriptionAction({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    setMessage("התראות לטלפון הופעלו.");
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

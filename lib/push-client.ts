"use client";

import { savePushSubscriptionAction } from "@/lib/actions";

export function isAppInstalled() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}

export function notificationsAllowed() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return { ok: false as const, error: "הדפדפן הזה לא תומך בהתראות." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false as const, error: "לא אושרה הרשאת התראות." };
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !("PushManager" in window)) {
    return { ok: true as const };
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false as const, error: "לא הצלחנו לשמור את ההרשאה." };
  }
  await savePushSubscriptionAction({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return { ok: true as const };
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

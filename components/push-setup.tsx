"use client";

import { useEffect } from "react";
import { enablePushNotifications, notificationsAllowed } from "@/lib/push-client";

export function PushSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js");
    if (notificationsAllowed()) {
      void enablePushNotifications();
    }
  }, []);
  return null;
}

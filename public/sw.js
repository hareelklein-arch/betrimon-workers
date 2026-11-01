self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = { title: "בית רימון", body: "יש עדכון חדש", url: "/", tag: "betrimon", urgent: false };
  try {
    data = event.data ? { ...data, ...event.data.json() } : data;
  } catch {
    data.body = event.data ? event.data.text() : data.body;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "בית רימון", {
      body: data.body,
      lang: "he",
      dir: "rtl",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 80, 200, 80, 200],
      tag: data.tag || "betrimon",
      renotify: true,
      requireInteraction: Boolean(data.urgent),
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const origin = self.location.origin;
      for (const client of all) {
        if (String(client.url).startsWith(origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

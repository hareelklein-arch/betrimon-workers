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
      icon: "/icon.svg",
      badge: "/icon.svg",
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
  event.waitUntil(clients.openWindow(url));
});

self.addEventListener("push", (event) => {
  let data = { title: "בית רימון", body: "יש עדכון חדש" };
  try {
    data = event.data ? event.data.json() : data;
  } catch {
    data.body = event.data ? event.data.text() : data.body;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "בית רימון", {
      body: data.body,
      lang: "he",
      dir: "rtl",
      icon: "/icon.svg",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});

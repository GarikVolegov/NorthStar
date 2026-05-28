self.addEventListener("push", (event) => {
  let title = "NorthStar";
  let body = "Hai un promemoria";
  let url = "/dashboard";
  let tag = "northstar-notification";
  let notificationId = null;
  let iconKey = "bell";
  let source = "system";
  let iconUrl = "/favicon.svg";
  let badgeUrl = "/favicon.svg";

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.url) url = data.url;
      if (data.tag) tag = data.tag;
      if (data.notificationId) notificationId = data.notificationId;
      if (data.iconKey) iconKey = data.iconKey;
      if (data.source) source = data.source;
      if (data.iconUrl) iconUrl = data.iconUrl;
      if (data.badgeUrl) badgeUrl = data.badgeUrl;
    } catch {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: iconUrl,
      badge: badgeUrl,
      tag,
      renotify: true,
      actions: [{ action: "open", title: "Apri" }],
      data: { notificationId, url, iconKey, source },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(target) && "focus" in client) {
            client.postMessage({
              type: "notification:opened",
              notificationId: event.notification.data && event.notification.data.notificationId,
            });
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(target);
        }
      }),
  );
});

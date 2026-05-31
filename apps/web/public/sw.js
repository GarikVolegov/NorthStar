self.addEventListener("push", (event) => {
  let title = "NorthStar";
  let body = "Hai un promemoria";
  let icon = "/favicon.svg";
  let badge = "/favicon.svg";
  let tag = "northstar-reminder";
  let url = "/calendario";

  if (event.data) {
    try {
      const data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
      if (data.iconUrl) icon = data.iconUrl;
      if (data.badgeUrl) badge = data.badgeUrl;
      if (data.tag) tag = data.tag;
      if (data.url) url = data.url;
    } catch {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/calendario";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(target) && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(target);
        }
      }),
  );
});

const VIP_PRIVATE_URL = "/?tab=private&from=push";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = {
      body: event.data ? event.data.text() : "새 1:1 메시지가 도착했습니다.",
    };
  }

  const targetUrl = new URL(
    data.url || VIP_PRIVATE_URL,
    self.location.origin
  ).href;

  event.waitUntil(
    self.registration.showNotification(
      data.title || "AI PROCESS VIP · 1:1 새 메시지",
      {
        body: data.body || "새 1:1 메시지가 도착했습니다.",
        icon: "/avatars/vip_01.png",
        badge: "/avatars/vip_01.png",
        tag: data.tag || "vip-private-message",
        renotify: true,
        silent: false,
        data: { url: targetUrl },
      }
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(
    event.notification?.data?.url || VIP_PRIVATE_URL,
    self.location.origin
  );
  targetUrl.searchParams.set("tab", "private");
  targetUrl.searchParams.set("from", "push");

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        try {
          const current = new URL(client.url);
          if (current.origin !== self.location.origin) continue;

          let targetClient = client;
          if ("navigate" in client) {
            targetClient = (await client.navigate(targetUrl.href)) || client;
          }
          if ("focus" in targetClient) await targetClient.focus();

          try {
            targetClient.postMessage({
              type: "VIP_OPEN_PRIVATE",
              url: targetUrl.href,
            });
          } catch (_) {}
          return;
        } catch (_) {}
      }

      if (self.clients.openWindow) {
        const opened = await self.clients.openWindow(targetUrl.href);
        if (opened) {
          try { await opened.focus(); } catch (_) {}
          try {
            opened.postMessage({
              type: "VIP_OPEN_PRIVATE",
              url: targetUrl.href,
            });
          } catch (_) {}
        }
      }
    })()
  );
});

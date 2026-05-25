let appPromise;

function loadApp() {
  appPromise ??= import("../apps/server/api/index.js").then(
    (module) => module.default ?? module,
  );
  return appPromise;
}

async function handler(req, res) {
  const app = await loadApp();
  return app(req, res);
}

handler.config = {
  maxDuration: 60,
};

module.exports = handler;

import app from "./app";
import http from "node:http";
import { rootLogger } from "./middleware/logger";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const { createWsServer } = await import("@workspace/ws-server");
const wss = createWsServer(httpServer);

import("./ws").then(({ setWss }) => setWss(wss));

httpServer.listen(PORT, () => {
  rootLogger.info({ port: PORT, wsPath: "/ws" }, "NorthStar API Server started");
});

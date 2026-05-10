/**
 * Growth Agent router — mounts all sub-routes under /api/growth-agent/
 *
 * Routes:
 *   POST   /chat          — SSE streaming chat (wrapped in Circuit Breaker)
 *   GET    /memory        — persistent facts + patterns for the user
 *   GET    /analytics     — session analytics dashboard data
 *   POST   /feedback      — thumbs up/down on a response
 *   POST   /ingest        — add a document to the knowledge base
 *   GET    /knowledge     — list knowledge base documents
 *   GET    /notifications — unread coaching nudges
 *   POST   /page-context  — save page context snapshot (analytics)
 */
import { Router } from "express";
import chat         from "./chat";
import memory       from "./memory";
import analytics    from "./analytics";
import feedback     from "./feedback";
import ingest       from "./ingest";
import knowledge    from "./knowledge";
import notifications from "./notifications";
import pageContext  from "./page-context";

const router = Router();

router.use("/chat",         chat);
router.use("/memory",       memory);
router.use("/analytics",    analytics);
router.use("/feedback",     feedback);
router.use("/ingest",       ingest);
router.use("/knowledge",    knowledge);
router.use("/notifications", notifications);
router.use("/page-context",  pageContext);

export default router;

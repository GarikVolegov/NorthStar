import { Router } from "express";
import { requireAdminAccess } from "../middleware/auth";
import adminAgentsRouter from "./admin/agents";
import adminBusinessRouter from "./admin/business";
import adminCatalogsRouter from "./admin/catalogs";
import adminErrorReportRouter from "./admin/error-report";
import adminGrowthQueueRouter from "./admin/growth-queue";
import adminMemoryGraphRouter from "./admin/memory-graph";
import adminOpsRouter from "./admin/ops";
import adminPromptsRouter from "./admin/prompts";
import adminQualityRouter from "./admin/quality";
import adminResearchRouter from "./admin/research";
import adminReviewRouter from "./admin/review";
import adminSubscriptionsRouter from "./admin/subscriptions";

const router = Router();

router.use(requireAdminAccess);
router.use(adminReviewRouter);
router.use(adminAgentsRouter);
router.use(adminSubscriptionsRouter);
router.use(adminOpsRouter);
router.use(adminBusinessRouter);
router.use(adminCatalogsRouter);
router.use(adminGrowthQueueRouter);
router.use(adminPromptsRouter);
router.use(adminQualityRouter);
router.use(adminMemoryGraphRouter);
router.use(adminErrorReportRouter);
router.use(adminResearchRouter);

export default router;

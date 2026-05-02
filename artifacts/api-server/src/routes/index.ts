import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sectorsRouter from "./sectors";
import testSessionsRouter from "./testSessions";
import usersRouter from "./users";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sectorsRouter);
router.use(testSessionsRouter);
router.use(usersRouter);
router.use(stripeRouter);

export default router;

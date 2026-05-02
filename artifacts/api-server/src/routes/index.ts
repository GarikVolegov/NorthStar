import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sectorsRouter from "./sectors";
import testSessionsRouter from "./testSessions";
import usersRouter from "./users";
import stripeRouter from "./stripe";
import newsRouter from "./news";
import authRouter from "./auth";
import profileRouter from "./profile";

const router: IRouter = Router();

router.use(authRouter);
router.use(profileRouter);
router.use(healthRouter);
router.use(sectorsRouter);
router.use(testSessionsRouter);
router.use(usersRouter);
router.use(stripeRouter);
router.use(newsRouter);

export default router;

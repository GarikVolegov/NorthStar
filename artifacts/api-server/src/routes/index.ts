import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sectorsRouter from "./sectors";
import testSessionsRouter from "./testSessions";
import usersRouter from "./users";
import stripeRouter from "./stripe";
import newsRouter from "./news";
import authRouter from "./auth";
import profileRouter from "./profile";
import favoritesRouter from "./favorites";
import objectivesRouter from "./objectives";
import wikiRouter from "./wiki";
import roadmapRouter from "./roadmap";
import grafoRouter from "./grafo";
import sitemapRouter from "./sitemap";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(authRouter);
router.use(profileRouter);
router.use(favoritesRouter);
router.use(objectivesRouter);
router.use(healthRouter);
router.use(sectorsRouter);
router.use(testSessionsRouter);
router.use(usersRouter);
router.use(stripeRouter);
router.use(newsRouter);
router.use(wikiRouter);
router.use(roadmapRouter);
router.use(grafoRouter);
router.use(sitemapRouter);
router.use(contactRouter);

export default router;

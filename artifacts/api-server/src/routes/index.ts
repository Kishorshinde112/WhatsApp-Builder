import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import contactsRouter from "./contacts.js";
import campaignsRouter from "./campaigns.js";
import trackingRouter from "./tracking.js";
import providersRouter from "./providers.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactsRouter);
router.use(campaignsRouter);
router.use(trackingRouter);
router.use(providersRouter);

export default router;

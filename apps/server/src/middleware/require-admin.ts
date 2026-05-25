import type { RequestHandler } from "express";
import { requireAuth } from "./require-auth";

export const requireAdmin: RequestHandler = requireAuth({ role: "admin" });

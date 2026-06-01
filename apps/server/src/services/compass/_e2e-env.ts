/**
 * _e2e-env — carica .env.local (Neon) con override PRIMA che @workspace/db
 * valuti il proprio dotenv (che caricherebbe il .env root → localhost).
 * Va importato per PRIMO nei test E2E che devono colpire il DB reale.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
// apps/server/src/services/compass → su 5 livelli = radice worktree
dotenv.config({ path: path.resolve(dir, "../../../../../.env.local"), override: true });

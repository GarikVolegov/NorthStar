import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(rootDir, ".env"));
loadEnvFile(path.join(rootDir, "apps/server/.env"));

function argValue(name: string) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1).trim();

  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1]?.trim() ?? "";
  return "";
}

const email = argValue("--email").toLowerCase();
const providedKey = argValue("--key") || process.env.ADMIN_BREAK_GLASS_KEY_INPUT || "";
const expectedKey = process.env.ADMIN_BREAK_GLASS_KEY || "";

if (!email) {
  console.error("Uso: pnpm admin:promote --email admin@example.com --key <break-glass-key>");
  process.exit(1);
}

if (!expectedKey) {
  console.error("ADMIN_BREAK_GLASS_KEY non configurata lato server.");
  process.exit(1);
}

if (!providedKey || providedKey !== expectedKey) {
  console.error("Chiave break-glass non valida.");
  process.exit(1);
}

const { auditLogTable, db, usersTable } = await import("@workspace/db");

const [user] = await db
  .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
  .from(usersTable)
  .where(eq(usersTable.email, email))
  .limit(1);

if (!user) {
  console.error(`Utente non trovato: ${email}`);
  process.exit(1);
}

if (user.role !== "admin") {
  await db
    .update(usersTable)
    .set({ role: "admin", isAdmin: true, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));
}

await db.insert(auditLogTable).values({
  actorId: null,
  targetId: user.id,
  action: "admin_break_glass_promote",
  category: "admin_action",
  metadata: {
    email: user.email,
    previousRole: user.role,
    promotedRole: "admin",
    source: "scripts/src/admin-promote.ts",
  },
});

console.log(`Admin promosso: ${user.email} (id ${user.id})`);

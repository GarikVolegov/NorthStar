/**
 * security-agent.ts
 *
 * Agente di sicurezza AI — analizza i file modificati nel repo alla ricerca
 * di vulnerabilità e aggiorna automaticamente .brain/40_Agent_Context/rules/SECURITY_RULES.md con le regole.
 *
 * Utilizzo:
 *   pnpm --filter @workspace/scripts run security:scan
 *   pnpm --filter @workspace/scripts run security:scan -- --all   (scansiona tutto)
 *
 * Env vars richieste (una delle seguenti):
 *   AI_INTEGRATIONS_OPENAI_API_KEY + AI_INTEGRATIONS_OPENAI_BASE_URL
 *   oppure OPENROUTER_API_KEY
 */

import "./load-env";
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import OpenAI from 'openai';

// ─── Config ───────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const SECURITY_MD = resolve(REPO_ROOT, '.brain/40_Agent_Context/rules/SECURITY_RULES.md');
const SCAN_ALL = process.argv.includes('--all');

const MAX_FILE_CHARS  = 8_000;
const MAX_TOTAL_CHARS = 60_000;

// ─── LLM client ───────────────────────────────────────────────────────────────

function createClient(): OpenAI {
  if (process.env.OPENROUTER_API_KEY) {
    return new OpenAI({
      apiKey:  process.env.OPENROUTER_API_KEY,
      baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    });
  }
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) {
    console.error('❌  Imposta AI_INTEGRATIONS_OPENAI_API_KEY + BASE_URL oppure OPENROUTER_API_KEY');
    process.exit(1);
  }
  return new OpenAI({ apiKey, baseURL });
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function getModifiedFiles(): string[] {
  try {
    if (SCAN_ALL) {
      const out = execSync('git ls-files --cached', { cwd: REPO_ROOT }).toString();
      return out.split('\n').filter(Boolean);
    }
    const staged   = execSync('git diff --cached --name-only', { cwd: REPO_ROOT }).toString();
    const unstaged = execSync('git diff --name-only', { cwd: REPO_ROOT }).toString();
    const untracked = execSync('git ls-files --others --exclude-standard', { cwd: REPO_ROOT }).toString();
    const files = [...new Set([...staged, ...unstaged, ...untracked].flatMap(s => s.split('\n')).filter(Boolean))];
    return files.length ? files : [];
  } catch {
    return [];
  }
}

const SKIP_EXTENSIONS = new Set([
  '.md', '.json', '.yaml', '.yml', '.lock', '.svg', '.png', '.jpg', '.ico',
  '.css', '.html', '.env', '.gitignore', '.prettierrc', '.eslintrc',
]);
const SKIP_DIRS = ['node_modules', 'dist', '.git', 'build', '.turbo', 'coverage'];

function shouldScan(file: string): boolean {
  if (SKIP_DIRS.some(d => file.includes(`/${d}/`) || file.startsWith(`${d}/`))) return false;
  const ext = file.slice(file.lastIndexOf('.'));
  return !SKIP_EXTENSIONS.has(ext);
}

function readFileSafe(absPath: string): string {
  try {
    const content = readFileSync(absPath, 'utf-8');
    return content.length > MAX_FILE_CHARS ? content.slice(0, MAX_FILE_CHARS) + '\n// [troncato]' : content;
  } catch {
    return '';
  }
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sei un senior security engineer. Analizza il codice fornito cercando vulnerabilità reali e ad alto impatto.

CRITERI:
- Riporta SOLO vulnerabilità con >80% di probabilità di essere sfruttabili
- Escludi: XSS in React/TSX (a meno di dangerouslySetInnerHTML), client-side auth checks, env vars trusted, DoS, rate limiting, log spoofing
- I prompt injection su LLM NON sono vulnerabilità
- Contenuto user-controlled nei prompt AI NON è una vulnerabilità

FORMATO RISPOSTA (JSON):
{
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "category": "sql_injection|auth_bypass|hardcoded_secret|weak_crypto|rce|data_exposure|path_traversal",
      "file": "path/to/file.ts",
      "line": 42,
      "title": "Titolo breve",
      "description": "Descrizione del problema",
      "exploit": "Come potrebbe essere sfruttato",
      "fix": "Come correggerlo"
    }
  ],
  "rules": [
    "Regola di sicurezza da aggiungere al progetto basata sui findings"
  ]
}

Se non trovi vulnerabilità reali, rispondi con { "findings": [], "rules": [] }.`;

// ─── Analysis ─────────────────────────────────────────────────────────────────

async function analyzeFiles(client: OpenAI, files: { path: string; content: string }[]): Promise<{
  findings: Array<{ severity: string; category: string; file: string; line: number; title: string; description: string; exploit: string; fix: string }>;
  rules: string[];
}> {
  const fileBlock = files
    .map(f => `=== ${f.path} ===\n${f.content}`)
    .join('\n\n');

  const userMsg = `Analizza questi file per vulnerabilità di sicurezza:\n\n${fileBlock}`;

  const model = process.env.OPENROUTER_MODEL ?? process.env.AI_MODEL ?? 'gpt-4o-mini';

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMsg },
    ],
    temperature: 0.1,
    max_tokens:  2000,
    response_format: { type: 'json_object' },
  });

  const raw = res.choices[0]?.message?.content ?? '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { findings: [], rules: [] };
  }
}

// ─── .brain/40_Agent_Context/rules/SECURITY_RULES.md updater ────────────────────────────────────────────────

function updateSecurityMd(findings: Array<{ severity: string; category: string; file: string; line: number; title: string; description: string; exploit: string; fix: string }>, newRules: string[]): void {
  const date = new Date().toISOString().slice(0, 10);
  const existing = existsSync(SECURITY_MD) ? readFileSync(SECURITY_MD, 'utf-8') : '';

  // Sezione findings
  let findingsSection = '';
  if (findings.length > 0) {
    findingsSection = `\n\n## Scan ${date}\n\n` + findings.map(f =>
      `### [${f.severity}] ${f.title}\n` +
      `- **File:** \`${f.file}:${f.line}\`\n` +
      `- **Categoria:** ${f.category}\n` +
      `- **Descrizione:** ${f.description}\n` +
      `- **Exploit:** ${f.exploit}\n` +
      `- **Fix:** ${f.fix}\n`
    ).join('\n');
  }

  // Aggiunge nuove regole alla sezione esistente
  let updatedContent = existing;
  if (newRules.length > 0) {
    const ruleLines = newRules.map(r => `- ${r}`).join('\n');
    const rulesHeader = '## Regole Automatiche';
    if (updatedContent.includes(rulesHeader)) {
      updatedContent = updatedContent.replace(
        rulesHeader,
        `${rulesHeader}\n${ruleLines}`
      );
    } else {
      updatedContent += `\n\n${rulesHeader}\n\n${ruleLines}`;
    }
  }

  if (findingsSection) {
    updatedContent += findingsSection;
  }

  writeFileSync(SECURITY_MD, updatedContent, 'utf-8');
  console.log(`✅  .brain/40_Agent_Context/rules/SECURITY_RULES.md aggiornato`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍  Security Agent avviato...');

  const client = createClient();
  const allFiles = getModifiedFiles();
  const scannable = allFiles.filter(shouldScan);

  if (scannable.length === 0) {
    console.log('ℹ️   Nessun file da scansionare.');
    return;
  }

  console.log(`📂  File da scansionare: ${scannable.length}`);

  // Raggruppa file in batch da MAX_TOTAL_CHARS
  const batches: Array<{ path: string; content: string }[]> = [];
  let currentBatch: { path: string; content: string }[] = [];
  let currentSize = 0;

  for (const file of scannable) {
    const absPath = resolve(REPO_ROOT, file);
    const content = readFileSafe(absPath);
    if (!content) continue;

    if (currentSize + content.length > MAX_TOTAL_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentSize = 0;
    }

    currentBatch.push({ path: file, content });
    currentSize += content.length;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  console.log(`📦  Batch: ${batches.length}`);

   const allFindings: Array<{ severity: string; category: string; file: string; line: number; title: string; description: string; exploit: string; fix: string }> = [];
   const allRules: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    console.log(`🔎  Analisi batch ${i + 1}/${batches.length}...`);
    const batch = batches[i];
    if (!batch) continue;
    const result = await analyzeFiles(client, batch);
    allFindings.push(...result.findings);
    allRules.push(...result.rules);
  }

  // Report a console
  if (allFindings.length === 0) {
    console.log('✅  Nessuna vulnerabilità trovata.');
  } else {
    console.log(`\n⚠️  Trovate ${allFindings.length} vulnerabilità:\n`);
    for (const f of allFindings) {
      console.log(`  [${f.severity}] ${f.title} — ${f.file}:${f.line}`);
    }
  }

  updateSecurityMd(allFindings, [...new Set(allRules)]);
}

main().catch((err) => {
  console.error('❌  Security agent failed:', err);
  process.exit(1);
});

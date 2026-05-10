const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\osman\\Documents\\GitHub\\NorthStar';

const exists = (p) => fs.existsSync(p) || fs.existsSync(p + '.ts') || fs.existsSync(p + '.js');

console.log('\n=== Checking apps/server/src/lib/ ===');
const serverLib = path.join(ROOT, 'apps/server/src/lib');
if (fs.existsSync(serverLib)) {
  for (const entry of fs.readdirSync(serverLib, {recursive:true})) {
    const p = path.join(serverLib, entry);
    if (fs.statSync(p).isFile()) {
      console.log('  FOUND: apps/server/src/' + entry);
    }
  }
} else {
  console.log('  apps/server/src/lib/ DOES NOT EXIST');
}

console.log('\n=== Checking which apps/server/src files still have ../lib/ imports ===');
function walkFiles(dir, cb) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.migration-backup') continue;
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fp, cb);
    else if (/\.(ts|tsx)$/.test(fp)) cb(fp);
  }
}

const broken = [];
walkFiles(path.join(ROOT, 'apps/server/src'), (fp) => {
  const content = fs.readFileSync(fp, 'utf8');
  // Only check ../lib/ imports that go ABOVE apps/server/src/
  const relLibs = content.match(/from\s+["']\.\.\/[^"']*["']/g) || [];
  const brokenImports = relLibs.filter(imp => {
    const match = imp.match(/from\s+"(\.\.\/[^\"]+)"/);
    if (!match) return false;
    const resolved = path.resolve(path.dirname(fp), match[1]);
    const checkExtensions = ['.ts','.tsx','.js','.jsx',''];
    for (const ext of checkExtensions) {
      if (fs.existsSync(resolved + ext)) return false;
      if (fs.existsSync(path.join(resolved, 'index.ts'))) return false;
      if (fs.existsSync(path.join(resolved, 'index.js'))) return false;
    }
    return true;
  });
  if (brokenImports.length > 0) {
    const rel = path.relative(ROOT, fp);
    brokenImports.forEach(imp => {
      broken.push({ file: rel, imp });
      console.log(`  BROKEN: ${rel} -> ${imp.trim()}`);
    });
  }
});
console.log(`\nTotal broken imports: ${broken.length}`);

if (broken.length === 0) {
  console.log('\nNo broken imports found - all ../lib/ references point to existing files in apps/server/src/lib/');
}

// Check agents specifically
console.log('\n=== Checking apps/server/src/agents/ imports ===');
const agentsDir = path.join(ROOT, 'apps/server/src/agents');
if (fs.existsSync(agentsDir)) {
  for (const f of fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts'))) {
    const content = fs.readFileSync(path.join(agentsDir, f), 'utf8');
    const imports = content.match(/from\s+["'][^"']+["']/g) || [];
    imports.forEach(imp => {
      const m = imp.match(/from\s+"([^"]+)"/);
      if (m && m[1].startsWith('..')) {
        const resolved = path.resolve(agentsDir, m[1]);
        const checkExts = ['.ts','.js','/index.ts','/index.js'];
        const exists = checkExts.some(e => fs.existsSync(resolved + e));
        if (!exists) {
          // Also check as internal lib
          const alt = path.join(ROOT, 'apps/server/src/lib', path.basename(m[1]) + '.ts');
          const alt2 = path.join(ROOT, 'apps/server/src/lib', path.basename(m[1]));
          console.log(`  UNRESOLVED: agents/${f} imports "${m[1]}"`);
          if (fs.existsSync(alt)) console.log(`    -> exists at apps/server/src/lib/${path.basename(m[1])}.ts`);
          if (fs.existsSync(alt2)) console.log(`    -> exists at apps/server/src/lib/${path.basename(m[1])}/`);
          if (!fs.existsSync(alt) && !fs.existsSync(alt2)) console.log(`    -> does NOT exist anywhere`);
        }
      }
    });
  }
}

console.log('\n=== Checking apps/server/src/routes/ imports ===');
const routesDir = path.join(ROOT, 'apps/server/src/routes');
if (fs.existsSync(routesDir)) {
  const routeFiles = [];
  walkFiles(routesDir, (fp) => routeFiles.push(fp));
  let brokenCount = 0;
  routeFiles.forEach(fp => {
    const content = fs.readFileSync(fp, 'utf8');
    const imports = content.match(/from\s+["'][^"']+["']/g) || [];
    imports.forEach(imp => {
      const m = imp.match(/from\s+"([^"]+)"/);
      if (m && m[1].startsWith('..') && m[1].includes('lib/')) {
        const resolved = path.resolve(path.dirname(fp), m[1]);
        const checkExts = ['.ts','.js','/index.ts','/index.js'];
        const exists = checkExts.some(e => fs.existsSync(resolved + e));
        if (!exists) {
          // Check if it exists in migration-backup
          const backupFile = path.join(ROOT, '.migration-backup', 'apps', 'server', 'src', 'lib', path.relative(path.join(path.dirname(fp), '..', 'lib'), resolved));
          const rel = path.relative(ROOT, fp);
          console.log(`  BROKEN ROUTE IMPORT: ${rel} -> ${m[1]} (resolved: ${path.relative(ROOT, resolved)})`);
          brokenCount++;
        }
      }
    });
  });
  if (brokenCount === 0) console.log('  (no broken imports)');
}

// Check for files imported from old lib/ paths
console.log('\n=== Checking for old lib/ package references (non workspace) ===');
walkFiles(ROOT, /\.(ts|tsx|json)$/, (fp) => {
  const content = fs.readFileSync(fp, 'utf8');
  const oldRefs = content.match(/@workspace\/integrations-openai-ai-(server|react)/g);
  if (oldRefs) {
    console.log(`  ${path.relative(ROOT, fp)}: ${oldRefs.join(', ')}`);
  }
});

console.log('\n=== DONE ===');
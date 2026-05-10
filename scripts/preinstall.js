#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Remove package-lock.json and yarn.lock
try {
  const packageLock = path.join(__dirname, '..', 'package-lock.json');
  const yarnLock = path.join(__dirname, '..', 'yarn.lock');
  
  if (fs.existsSync(packageLock)) {
    fs.unlinkSync(packageLock);
  }
  if (fs.existsSync(yarnLock)) {
    fs.unlinkSync(yarnLock);
  }
} catch (err) {
  console.error('Error removing lock files:', err);
}

// Check if using pnpm - if not using pnpm, fail
const userAgent = process.env.npm_config_user_agent || '';
if (userAgent && !userAgent.includes('pnpm')) {
  console.error('Use pnpm instead');
  process.exit(1);
}


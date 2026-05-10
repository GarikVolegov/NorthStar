#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

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


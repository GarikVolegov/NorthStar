#!/usr/bin/env node
// Cross-platform replacement for kill-port.ps1 — frees port 5173 before `dev:web` starts.
import { execSync } from 'child_process';

const port = 5173;

function killUnix() {
  let pids = '';
  try {
    pids = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' }).trim();
  } catch {
    return false;
  }
  if (!pids) return false;
  for (const pid of pids.split('\n').filter(Boolean)) {
    try {
      execSync(`kill -9 ${pid}`);
      console.log(`Killing process ${pid} on port ${port}...`);
    } catch {
      // process may have exited already
    }
  }
  return true;
}

function killWindows() {
  let output = '';
  try {
    output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  } catch {
    return false;
  }
  const pids = new Set();
  for (const line of output.split('\n')) {
    const match = line.trim().match(/(\d+)$/);
    if (match) pids.add(match[1]);
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`);
      console.log(`Killing process ${pid} on port ${port}...`);
    } catch {
      // process may have exited already
    }
  }
  return pids.size > 0;
}

const killed = process.platform === 'win32' ? killWindows() : killUnix();
if (!killed) {
  console.log(`No process was listening on port ${port}.`);
}
console.log(`Port ${port} is now free.`);

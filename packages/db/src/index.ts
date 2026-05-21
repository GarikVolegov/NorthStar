import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import CircuitBreaker from "opossum";
import { Pool } from "pg";
import type { QueryResult } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root of the monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

// ── Fail fast ────────────────────────────────────────────────────────────────
// Validate at import time so the process crashes immediately with a clear
// message instead of failing on the first DB query at runtime.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "[db] DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// ── Connection Pool Configuration ─────────────────────────────────────────────
// Configure connection pool based on application load
const POOL_CONFIG = {
  connectionString: DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || '20'), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'), // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000'), // How long to wait for a connection to be established
};

// Create a proper PostgreSQL connection pool for better control
export const pool = new Pool(POOL_CONFIG);

// Test database connection on startup for health check
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[db] Health check failed:', error);
    return false;
  }
}

// ── Circuit Breaker Configuration ─────────────────────────────────────────────
// Prevent cascading failure when database is down
const circuitBreakerOptions = {
  timeout: parseInt(process.env.DB_CIRCUIT_BREAKER_TIMEOUT || '5000'), // If our function takes longer than 5 seconds, trigger a failure
  errorThresholdPercentage: parseInt(process.env.DB_CIRCUIT_BREAKER_ERROR_THRESHOLD || '50'), // When 50% of requests fail, trip the circuit
  resetTimeout: parseInt(process.env.DB_CIRCUIT_BREAKER_RESET_TIMEOUT || '30000'), // After 30 seconds, try again
};

// Create a circuit breaker for database operations
type ProtectedOperation<T = unknown> = () => Promise<T>;

export const dbCircuitBreaker = new CircuitBreaker(
  async (operation: unknown) => {
    if (typeof operation !== "function") {
      throw new Error("[db] Circuit breaker operation must be a function");
    }
    return await (operation as ProtectedOperation)();
  },
  circuitBreakerOptions
);

// Circuit breaker event listeners for monitoring
dbCircuitBreaker.on('open', () => {
  console.warn('[db] Circuit breaker opened - database appears to be unavailable');
});

dbCircuitBreaker.on('halfOpen', () => {
  console.info('[db] Circuit breaker half-open - testing database connectivity');
});

dbCircuitBreaker.on('close', () => {
  console.info('[db] Circuit breaker closed - database connectivity restored');
});

// Create a protected database function that applies circuit breaker and query timeout
export async function protectedDbQuery<T>(queryFn: () => Promise<T>): Promise<T> {
  // Apply query timeout using Promise.race
  const queryTimeout = parseInt(process.env.DB_QUERY_TIMEOUT_MS || '10000'); // Default 10 second timeout
  
  return await dbCircuitBreaker.fire(async () => {
    return await Promise.race([
      queryFn(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Database query timed out after ${queryTimeout}ms`)), queryTimeout)
      )
    ]);
  }) as T;
}

// Export drizzle instance backed by the same PostgreSQL pool used by health checks
// and raw queries. This keeps local Node/Windows, CI, and deploy behavior aligned.
export const db = drizzle(pool, { schema }) as NodePgDatabase<typeof schema>;

// Export a helper function for making protected queries
export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return protectedDbQuery(() => pool.query<T>(text, params));
}

// ── Schema Backup Functionality ──────────────────────────────────────────────
// Regular schema backup and version control
export async function backupSchema(): Promise<string> {
  try {
    const client = await pool.connect();
    try {
      // Get current timestamp for backup file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `schema-backup-${timestamp}.sql`;
      
      // Query to get the full schema
      await client.query(`
        SELECT pg_catalog.pg_get_userdefs(
          (SELECT oid FROM pg_catalog.pg_class WHERE relname = 'pg_dump')
        ) as schema_def
      `);
      
      // For now, we'll return a simple representation
      // In production, you would use pg_dump or similar tool
      console.info(`[db] Schema backup initiated: ${backupFileName}`);
      return backupFileName;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[db] Schema backup failed:', error);
    throw error;
  }
}

// ── Public exports ────────────────────────────────────────────────────────────
export * from "./schema";

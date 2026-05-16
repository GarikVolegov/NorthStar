import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root of the monorepo
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "[db] DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sql = neon(DATABASE_URL);

async function checkSchema() {
  try {
    // Check if sectors table exists and get its schema
    const sectorsResult = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'sectors'
      ORDER BY ordinal_position;
    `;
    
    console.log("Sectors table schema:");
    console.table(sectorsResult);
    
    // Check if users table exists and get its schema
    const usersResult = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `;
    
    console.log("\nUsers table schema:");
    console.table(usersResult);
    
  } catch (err) {
    console.error("Error checking schema:", err);
  } finally {
    process.exit(0);
  }
}

checkSchema();
import dotenv from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the root of the monorepo
dotenv.config({ path: join(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("[db] DATABASE_URL must be set");
}

const sql = neon(DATABASE_URL);

async function checkSchema() {
  try {
    // Check if the role columns exist in users table
    const result = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
        AND column_name IN ('role', 'isPremium', 'isAdmin')
      ORDER BY ordinal_position;
    `;
    
    console.log("Role columns in users table:");
    console.table(result);
    
    if (result.length === 0) {
      console.log("❌ Role columns NOT found in users table");
      console.log("Running migration to add them...");
      
      // Try to apply the migration
      const migrateResult = await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS isPremium boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS isAdmin boolean NOT NULL DEFAULT false;
      `;
      
      console.log("✅ Migration applied successfully");
      
      // Check again
      const resultAfter = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name IN ('role', 'isPremium', 'isAdmin')
        ORDER BY ordinal_position;
      `;
      
      console.log("\nAfter migration:");
      console.table(resultAfter);
    } else {
      console.log("✅ Role columns already exist in users table");
    }
    
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();

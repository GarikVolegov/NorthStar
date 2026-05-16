const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function applyMigration() {
  const client = await pool.connect();
  try {
    console.log('Applying migration 0012...');
    
    // Add composite index for LLM cost aggregation
    await client.query(`
      CREATE INDEX IF NOT EXISTS llm_usage_user_created_idx 
      ON llm_usage (user_id, created_at);
    `);
    console.log('✅ Created composite index llm_usage_user_created_idx');
    
    // Add index on users.email for JOIN performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS users_email_idx 
      ON users (email);
    `);
    console.log('✅ Created index users_email_idx');
    
    console.log('✅ Migration 0012 applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
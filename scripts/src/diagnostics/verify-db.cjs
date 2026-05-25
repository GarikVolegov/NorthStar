const { Pool } = require('pg');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function verifyDatabase() {
  const client = await pool.connect();
  try {
    console.log('Verifying role columns...');
    
    // Check if columns exist
    const checkResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('role', 'isPremium', 'isAdmin')
      ORDER BY ordinal_position;
    `);
    
    console.log('Role columns in users table:');
    console.table(checkResult.rows);
    
    // Also check a few users to make sure we can read the data
    const usersResult = await client.query(`
      SELECT id, email, role, isPremium, isAdmin 
      FROM users 
      LIMIT 3;
    `);
    
    console.log('\nSample users:');
    console.table(usersResult.rows);
    
  } catch (err) {
    console.error('❌ Error verifying database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

verifyDatabase();

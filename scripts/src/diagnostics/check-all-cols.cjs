const { Pool } = require('pg');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAllColumns() {
  const client = await pool.connect();
  try {
    console.log('Checking ALL columns in users table...');
    
    // Check if columns exist
    const checkResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    
    console.log('All columns in users table:');
    console.table(checkResult.rows);
    
    // Filter for our specific columns
    const roleCols = checkResult.rows.filter(r => 
      ['role', 'isPremium', 'isAdmin'].includes(r.column_name));
    
    console.log('\nOur role-related columns:');
    console.table(roleCols);
    
  } catch (err) {
    console.error('❌ Error checking database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAllColumns();

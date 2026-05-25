const { Pool } = require('pg');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixDatabase() {
  const client = await pool.connect();
  try {
    console.log('Checking if role columns exist...');
    
    // Check if columns exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('role', 'isPremium', 'isAdmin');
    `);
    
    console.log('Existing role columns:', checkResult.rows.map(r => r.column_name));
    
    // Add missing columns
    if (!checkResult.rows.some(r => r.column_name === 'role')) {
      console.log('Adding role column...');
      await client.query(`ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user';`);
    }
    
    if (!checkResult.rows.some(r => r.column_name === 'isPremium')) {
      console.log('Adding isPremium column...');
      await client.query(`ALTER TABLE users ADD COLUMN isPremium boolean NOT NULL DEFAULT false;`);
    }
    
    if (!checkResult.rows.some(r => r.column_name === 'isAdmin')) {
      console.log('Adding isAdmin column...');
      await client.query(`ALTER TABLE users ADD COLUMN isAdmin boolean NOT NULL DEFAULT false;`);
    }
    
    console.log('✅ Database schema updated successfully');
  } catch (err) {
    console.error('❌ Error updating database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixDatabase();

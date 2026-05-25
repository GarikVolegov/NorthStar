// Test database connection using the existing db setup
const { db } = require('../../../packages/db/src/index');
const { usersTable } = require('../../../packages/db/src/schema/users');
const { eq } = require('drizzle-orm');

async function testConnection() {
  try {
    console.log('Testing database connection...');
    
    // Try a simple query
    const result = await db.select().from(usersTable).limit(1);
    console.log('✅ Database connection successful');
    console.log('Query result length:', result.length);
    
    // Check if role column exists by trying to select it
    try {
      const roleResult = await db
        .select({
          id: usersTable.id,
          role: usersTable.role
        })
        .from(usersTable)
        .limit(1);
      
      console.log('✅ Role column exists:', roleResult.length > 0);
    } catch (roleError) {
      console.log('❌ Role column does not exist or error accessing it:', roleError.message);
      
      // Try to add the columns using raw SQL via the pool
      const { pool } = require('../../../packages/db/src/index');
      
      console.log('Attempting to add missing columns...');
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS isPremium boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS isAdmin boolean NOT NULL DEFAULT false;
      `);
      
      console.log('✅ Added missing columns');
      
      // Verify the columns now exist
      const verifyResult = await db
        .select({
          id: usersTable.id,
          role: usersTable.role,
          isPremium: usersTable.isPremium,
          isAdmin: usersTable.isAdmin
        })
        .from(usersTable)
        .limit(1);
      
      console.log('✅ Columns verified:', verifyResult.length > 0);
    }
    
  } catch (err) {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  }
}

testConnection();

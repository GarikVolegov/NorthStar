// Test auth query directly using pg
const { Pool } = require('pg');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testAuthQuery() {
  const client = await pool.connect();
  try {
    console.log('Testing auth query with role columns...');
    
    // This mimics what the requireAuth middleware does
    const result = await client.query(`
      SELECT 
        id, 
        name, 
        email,
        role,
        stripe_subscription_id AS "stripeSubscriptionId",
        journey_type AS "journeyType",
        test_session_id AS "testSessionId",
        onboarding_completed AS "onboardingCompleted"
      FROM users 
      LIMIT 1;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const user = result.rows[0];
    
    console.log('✅ Auth query successful:');
    console.log('  ID:', user.id);
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Stripe Subscription ID:', user.stripeSubscriptionId);
    console.log('  Journey Type:', user.journeyType);
    console.log('  Test Session ID:', user.testSessionId);
    console.log('  Onboarding Completed:', user.onboardingCompleted);
    
  } catch (err) {
    console.error('❌ Auth query failed:', err);
    console.error('Error details:', err.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

testAuthQuery();

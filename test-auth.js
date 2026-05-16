// Test the auth middleware directly
const { db } = require('./packages/db/src/index.js');
const { usersTable } = require('./packages/db/src/schema/users.js');
const { eq } = require('drizzle-orm');
require('dotenv').config({ path: '.env' });

async function testAuthQuery() {
  try {
    console.log('Testing auth query with role columns...');
    
    // This mimics what the requireAuth middleware does
    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role, // This should now work
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        journeyType: usersTable.journeyType,
        testSessionId: usersTable.testSessionId,
        onboardingCompleted: usersTable.onboardingCompleted,
      })
      .from(usersTable)
      .limit(1);
    
    if (!user) {
      console.log('❌ No users found in database');
      return;
    }
    
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
  }
}

testAuthQuery();
/**
 * Script to fetch Credas journeys and actor IDs
 * Run this to get the IDs needed for your .env file
 *
 * Usage:
 *   npx ts-node scripts/get-credas-journeys.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const CREDAS_API_KEY = process.env.CREDAS_API_KEY;
const CREDAS_BASE_URL = process.env.CREDAS_BASE_URL || 'https://portal.credasdemo.com/api/v2';

async function getJourneys() {
  try {
    console.log('🔍 Fetching Credas journeys...\n');
    console.log(`API URL: ${CREDAS_BASE_URL}/ci/journeys`);
    console.log(`API Key: ${CREDAS_API_KEY?.substring(0, 10)}...`);
    console.log('─'.repeat(80));

    const response = await axios.get(`${CREDAS_BASE_URL}/ci/journeys`, {
      headers: {
        'x-api-key': CREDAS_API_KEY!,
        'Content-Type': 'application/json',
      },
    });

    console.log('\n✅ Success! Found journeys:\n');

    if (!response.data || response.data.length === 0) {
      console.log('⚠️  No journeys found. Please create a journey in the Credas portal first.\n');
      return;
    }

    response.data.forEach((journey: any, index: number) => {
      console.log(`📋 Journey ${index + 1}:`);
      console.log(`   Name: ${journey.name || 'Unnamed Journey'}`);
      console.log(`   ID: ${journey.id}`);

      if (journey.actors && journey.actors.length > 0) {
        console.log(`   Actors:`);
        journey.actors.forEach((actor: any, actorIndex: number) => {
          console.log(`     ${actorIndex + 1}. ${actor.name || 'Unnamed Actor'}`);
          console.log(`        ID: ${actor.id}`);
        });
      } else {
        console.log(`   ⚠️  No actors found for this journey`);
      }
      console.log('─'.repeat(80));
    });

    console.log('\n📝 Update your .env file with these values:\n');

    // Suggest the first journey and first actor as defaults
    const firstJourney = response.data[0];
    const firstActor = firstJourney.actors?.[0];

    if (firstJourney && firstActor) {
      console.log(`CREDAS_JOURNEY_ID=${firstJourney.id}`);
      console.log(`CREDAS_ACTOR_ID=${firstActor.id}`);
      console.log('\n💡 These are the first journey and actor found.');
      console.log('   Choose different ones if needed based on your requirements.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Error fetching journeys:');

    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
      console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('   No response received from Credas API');
      console.error('   Please check your internet connection and API URL');
    } else {
      console.error(`   ${error.message}`);
    }

    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Verify your CREDAS_API_KEY in .env is correct');
    console.error('   2. Ensure CREDAS_BASE_URL is correct (demo vs live)');
    console.error('   3. Check that you have journeys created in the Credas portal');
    console.error('   4. Verify your internet connection\n');

    process.exit(1);
  }
}

// Run the script
getJourneys();

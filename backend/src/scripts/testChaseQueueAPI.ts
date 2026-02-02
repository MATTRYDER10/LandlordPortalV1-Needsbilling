import { getChaseQueue } from '../services/chaseDependencyService';

async function testQueue() {
  console.log('Testing getChaseQueue() API...\n');

  const items = await getChaseQueue();

  console.log(`Total items in queue: ${items.length}\n`);

  if (items.length > 0) {
    console.log('Items:');
    items.forEach(item => {
      console.log(`  - ${item.dependencyType}: ${item.tenantName}`);
      console.log(`    Ref ID: ${item.referenceId}`);
      console.log(`    Days since request: ${item.daysSinceRequest}`);
      console.log(`    Urgency: ${item.urgency}`);
      console.log('');
    });
  }
}

testQueue();

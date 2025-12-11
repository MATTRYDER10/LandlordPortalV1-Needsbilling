// One-off script to rescore a guarantor reference after rent_share fix
import { assessApplicationScore } from '../services/application-assesment/assessApplication';

const referenceId = process.argv[2];

if (!referenceId) {
  console.error('Usage: npx ts-node src/scripts/rescoreGuarantor.ts <referenceId>');
  process.exit(1);
}

async function main() {
  console.log(`Rescoring reference ${referenceId}...`);

  try {
    await assessApplicationScore(referenceId, 'System');
    console.log('Rescoring complete!');
  } catch (error) {
    console.error('Error rescoring:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();

import { PrismaClient } from '@prisma/client';

import { spainManualCountrySeed } from './data/spanishOutletSeed';
import { loadSeedEnv, runManualCountrySeed } from './manualOutletSeedRunner';

const prisma = new PrismaClient();

async function main() {
  loadSeedEnv();
  await runManualCountrySeed(prisma, spainManualCountrySeed);
}

main()
  .catch((error) => {
    console.error('Error durante la seed manual de outlets españoles:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

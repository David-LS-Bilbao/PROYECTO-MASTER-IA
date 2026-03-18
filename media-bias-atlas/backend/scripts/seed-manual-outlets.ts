import { PrismaClient } from '@prisma/client';

import { manualOutletSeedCatalog } from './data/manualOutletSeedCatalog';
import { loadSeedEnv, runManualCountrySeed } from './manualOutletSeedRunner';

interface CliOptions {
  countryCode: string;
  validateOnly: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  let countryCode = '';
  let validateOnly = false;

  for (const arg of argv) {
    if (arg.startsWith('--country=')) {
      countryCode = arg.slice('--country='.length).trim().toUpperCase();
      continue;
    }

    if (arg === '--validate-only') {
      validateOnly = true;
    }
  }

  if (!countryCode) {
    throw new Error('Debes indicar --country=ES|GB|FR|DE|US');
  }

  return { countryCode, validateOnly };
}

async function main() {
  loadSeedEnv();

  const options = parseArgs(process.argv.slice(2));
  const seed = manualOutletSeedCatalog[options.countryCode];

  if (!seed) {
    throw new Error(`No existe una seed manual registrada para ${options.countryCode}`);
  }

  const prisma = new PrismaClient();

  try {
    await runManualCountrySeed(prisma, seed, {
      validateOnly: options.validateOnly,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Error durante la seed manual de outlets:', error);
  process.exit(1);
});

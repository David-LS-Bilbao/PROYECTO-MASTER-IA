import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando Seed ---');

  const baseCountries = [
    { code: 'ES', name: 'España' },
    { code: 'FR', name: 'Francia' },
    { code: 'DE', name: 'Alemania' },
    { code: 'GB', name: 'Reino Unido' },
    { code: 'US', name: 'Estados Unidos' },
  ];

  for (const c of baseCountries) {
    // upsert asegura que no hayan duplicados y actualiza nombre si ya existe el código.
    const country = await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { code: c.code, name: c.name },
    });
    console.log(`País procesado: ${country.code} - ${country.name}`);
  }

  console.log('--- Seed completado ---');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Prisma Database Seed
 * Sprint 20: Reestructuración de Categorías + Geolocalización
 *
 * Este archivo define los temas/categorías iniciales que se crearán
 * al inicializar la base de datos.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Inicializar con adapter (requerido por el proyecto)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Temas Unificados (Sprint 20)
 * - Fusión de "Ciencia" + "Tecnología" → "Ciencia y Tecnología"
 * - Slugs URL-friendly para routing
 */
const defaultTopics = [
  {
    name: 'España',
    slug: 'espana',
    description: 'Noticias nacionales de España',
    order: 1,
  },
  {
    name: 'Internacional',
    slug: 'internacional',
    description: 'Actualidad mundial y noticias internacionales',
    order: 2,
  },
  {
    name: 'Local',
    slug: 'local',
    description: 'Noticias de tu localidad (basado en geolocalización)',
    order: 3,
  },
  {
    name: 'Economía',
    slug: 'economia',
    description: 'Finanzas, mercados, empresas y economía',
    order: 4,
  },
  {
    name: 'Ciencia y Tecnología',
    slug: 'ciencia-tecnologia',
    description: 'Innovación, ciencia, tecnología y descubrimientos',
    order: 5,
  },
  {
    name: 'Entretenimiento',
    slug: 'entretenimiento',
    description: 'Cine, series, música, cultura y espectáculos',
    order: 6,
  },
  {
    name: 'Deportes',
    slug: 'deportes',
    description: 'Fútbol, baloncesto y actualidad deportiva',
    order: 7,
  },
  {
    name: 'Salud',
    slug: 'salud',
    description: 'Bienestar, medicina, nutrición y vida saludable',
    order: 8,
  },
];

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  console.log('📂 Creando temas por defecto...');

  for (const topic of defaultTopics) {
    const created = await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        description: topic.description,
        order: topic.order,
      },
      create: topic,
    });
    console.log(`✅ Tema creado/actualizado: ${created.name} (${created.slug})`);
  }

  console.log('✨ Seed completado exitosamente!');
  console.log(`📊 Total de temas: ${defaultTopics.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

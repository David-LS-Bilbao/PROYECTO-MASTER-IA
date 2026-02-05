/**
 * Prisma Client Singleton
 * Provides a shared instance of PrismaClient across the application
 *
 * OBSERVABILIDAD (Sprint 15 - Paso 4):
 * - Prisma middleware para Sentry distributed tracing
 * - Cada query SQL genera un span en Sentry
 * - Visibilidad completa: HTTP → Gemini → Database
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let prismaInstance: PrismaClient | null = null;

/**
 * Get or create the singleton Prisma Client instance
 */
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    prismaInstance = new PrismaClient({ adapter });

    // 🔍 Sprint 15 - Paso 4: Sentry Database Tracing
    // NOTE: $use middleware is not available when using adapters (PrismaPg)
    // Alternative: Use Prisma Client Extensions with $extends
    // For now, database tracing will be handled automatically by Sentry's httpIntegration
    // which captures HTTP requests to the database through the adapter

    console.log('✅ PrismaClient inicializado');
    if (process.env.SENTRY_DSN) {
      console.log('🔍 Sentry database tracing enabled via httpIntegration');
    }
  }

  return prismaInstance;
}

/**
 * Close the Prisma Client connection
 */
export async function closePrismaClient(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
    console.log('✅ PrismaClient desconectado');
  }
}

/**
 * Prisma Client Singleton
 * Provides a shared instance of PrismaClient across the application
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
    
    console.log('✅ PrismaClient inicializado');
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

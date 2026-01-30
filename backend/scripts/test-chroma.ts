/**
 * Script de prueba para verificar conexión con ChromaDB
 * Ejecutar: npx tsx scripts/test-chroma.ts
 */

import { ChromaClient } from '../src/infrastructure/external/chroma.client';

async function main() {
  console.log('=== Test de Conexión ChromaDB ===\n');

  const chromaClient = new ChromaClient();

  // Test 1: Health Check
  console.log('1. Probando healthCheck()...');
  const isHealthy = await chromaClient.healthCheck();
  console.log(`   Resultado: ${isHealthy ? '✅ Servidor disponible' : '❌ Servidor no responde'}\n`);

  if (!isHealthy) {
    console.log('❌ ChromaDB no está disponible. Verifica que Docker esté corriendo.');
    process.exit(1);
  }

  // Test 2: Init Collection
  console.log('2. Probando initCollection()...');
  const collectionReady = await chromaClient.initCollection();
  console.log(`   Resultado: ${collectionReady ? '✅ Colección inicializada' : '❌ Error al inicializar'}\n`);

  // Test 3: Get Collection
  console.log('3. Verificando colección...');
  const collection = chromaClient.getCollection();
  const count = await collection.count();
  console.log(`   Nombre: ${ChromaClient.getCollectionName()}`);
  console.log(`   Documentos: ${count}\n`);

  console.log('=== Todos los tests pasaron ✅ ===');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

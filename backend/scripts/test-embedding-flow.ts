/**
 * Script de prueba para verificar el flujo completo de embeddings
 * Ejecutar: npx tsx scripts/test-embedding-flow.ts
 */

import 'dotenv/config';
import { ChromaClient } from '../src/infrastructure/external/chroma.client';
import { GeminiClient } from '../src/infrastructure/external/gemini.client';
import { TokenTaximeter } from '../src/infrastructure/monitoring/token-taximeter';

async function main() {
  console.log('=== Test de Flujo de Embeddings ===\n');

  // 1. Test ChromaDB connection
  console.log('1. Conectando a ChromaDB...');
  const chromaClient = new ChromaClient();
  const isHealthy = await chromaClient.healthCheck();
  if (!isHealthy) {
    throw new Error('ChromaDB no disponible');
  }
  console.log('   ✅ ChromaDB conectado\n');

  // 2. Initialize collection
  console.log('2. Inicializando colección...');
  await chromaClient.initCollection();
  console.log('   ✅ Colección lista\n');

  // 3. Test Gemini embedding
  console.log('3. Probando generación de embedding con Gemini...');
  const tokenTaximeter = new TokenTaximeter();
  const geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '', tokenTaximeter);

  const testText = 'El Gobierno de España anuncia nuevas medidas económicas para combatir la inflación.';
  const embedding = await geminiClient.generateEmbedding(testText);

  console.log(`   ✅ Embedding generado - dimensiones: ${embedding.length}`);
  console.log(`   📊 Primeros 5 valores: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`);

  // 4. Test upsert to ChromaDB
  console.log('4. Insertando documento de prueba en ChromaDB...');
  const testId = 'test-article-' + Date.now();

  await chromaClient.upsertItem(
    testId,
    embedding,
    {
      title: 'Artículo de prueba',
      source: 'Test Source',
      publishedAt: new Date().toISOString(),
      biasScore: 0.25,
    },
    testText
  );
  console.log(`   ✅ Documento insertado con ID: ${testId}\n`);

  // 5. Verify count
  console.log('5. Verificando documentos en colección...');
  const collection = chromaClient.getCollection();
  const count = await collection.count();
  console.log(`   📊 Total documentos: ${count}\n`);

  // 6. Test query (similarity search)
  console.log('6. Probando búsqueda por similitud...');
  const queryText = 'medidas contra la inflación en España';
  const queryEmbedding = await geminiClient.generateEmbedding(queryText);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: 3,
  });

  console.log(`   🔍 Query: "${queryText}"`);
  console.log(`   📋 Resultados encontrados: ${results.ids[0]?.length || 0}`);

  if (results.documents[0]?.length) {
    console.log(`   📄 Mejor match: "${results.documents[0][0]?.substring(0, 60)}..."`);
    console.log(`   📏 Distancia: ${results.distances?.[0]?.[0]?.toFixed(4) || 'N/A'}`);
  }

  console.log('\n=== Todos los tests pasaron ✅ ===');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

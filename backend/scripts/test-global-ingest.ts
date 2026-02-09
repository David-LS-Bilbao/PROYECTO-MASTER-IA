/**
 * Test script for Global Ingest feature
 *
 * Tests the POST /api/ingest/all endpoint that ingests
 * news for ALL valid categories in batches.
 *
 * Usage: npx tsx scripts/test-global-ingest.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Fail fast if key is missing
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY is missing. Check backend/.env file.');
  process.exit(1);
}

async function testGlobalIngest() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║            Global Ingest Test (All Categories)                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const API_URL = 'http://localhost:3000/api/ingest/all';

  console.log('📡 Sending POST request to:', API_URL);
  console.log('⏳ This may take 1-2 minutes (processing all categories in batches)...\n');

  const startTime = Date.now();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Request failed:', response.status, response.statusText);
      console.error('   Error details:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    const result = await response.json();

    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                     Test Results                               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Global ingestion completed in ${duration}s`);
    console.log(`\n📊 Summary:`);
    console.log(`   - Categories processed: ${result.data.processed}`);
    console.log(`   - Errors: ${result.data.errors}`);
    console.log(`   - Total new articles: ${result.data.totalNewArticles}`);
    console.log(`   - Total duplicates: ${result.data.totalDuplicates}`);

    console.log(`\n📋 Per-Category Breakdown:`);

    const categories = Object.keys(result.data.categoryResults);
    categories.forEach((category) => {
      const categoryResult = result.data.categoryResults[category];
      const emoji = categoryResult.errors > 0 ? '⚠️' : '✅';
      console.log(
        `   ${emoji} ${category.padEnd(20)} - New: ${categoryResult.newArticles}, Duplicates: ${categoryResult.duplicates}`
      );
    });

    console.log('\n🎉 Test passed! Global ingest is working correctly.\n');
  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error('   Make sure the backend is running on http://localhost:3000');
    process.exit(1);
  }
}

testGlobalIngest().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

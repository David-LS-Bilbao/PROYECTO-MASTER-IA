/**
 * Verification Script: Zero Hallucination Strategy (RAG Chat)
 *
 * Tests if the updated RAG prompt correctly refuses to answer
 * questions that cannot be derived from the provided context.
 *
 * CRITICAL TEST: Verifies "Radical Uncertainty" rule - the AI must NOT
 * use general knowledge to "fill gaps" when context is insufficient.
 *
 * Usage: npx tsx backend/scripts/verify-rag-rules.ts
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

import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildRagChatPrompt } from '../src/infrastructure/external/prompts/rag-chat.prompt';

// Mock context about Verity News (intentionally limited)
const MOCK_CONTEXT = `Verity News es una startup fundada en 2026 en Bilbao. Se dedica a combatir la desinformación usando IA.`;

// Test cases
const testCases = [
  {
    type: 'Answerable (Context Available)',
    question: '¿Dónde se fundó Verity News?',
    context: MOCK_CONTEXT,
    expectedBehavior: 'Should answer "Bilbao" with citation [1]',
    shouldRefuse: false,
  },
  {
    type: 'The Trap (External Knowledge)',
    question: '¿Quién ganó el Mundial de Fútbol de 2010?',
    context: MOCK_CONTEXT,
    expectedBehavior: 'MUST refuse to answer - not in context',
    shouldRefuse: true,
    trapInfo: 'AI knows Spain won, but this info is NOT in context',
  },
];

interface TestResult {
  type: string;
  question: string;
  response: string;
  refused: boolean;
  passed: boolean;
}

async function runTest(
  model: any,
  testCase: (typeof testCases)[0]
): Promise<{ success: boolean; response: string; refused: boolean }> {
  try {
    // Build RAG prompt
    const prompt = buildRagChatPrompt(testCase.question, testCase.context);

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Check if AI refused to answer (Radical Uncertainty triggered)
    const refused =
      responseText.includes('El contexto disponible no contiene datos suficientes') ||
      responseText.includes('no contiene información') ||
      responseText.includes('no hay información') ||
      responseText.toLowerCase().includes('no puedo responder');

    return {
      success: true,
      response: responseText,
      refused,
    };
  } catch (error) {
    console.error(`   ❌ Error processing test case: ${(error as Error).message}`);
    return {
      success: false,
      response: 'ERROR',
      refused: false,
    };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     Zero Hallucination Strategy Verification Test             ║');
  console.log('║              (RAG Chat - Radical Uncertainty)                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize Gemini model
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  console.log('📋 Running test cases...\n');
  console.log('📝 Mock Context:');
  console.log(`   "${MOCK_CONTEXT}"\n`);

  // Results table
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.type}`);
    console.log(`   Question: "${testCase.question}"`);
    console.log(`   Expected: ${testCase.expectedBehavior}`);
    if (testCase.trapInfo) {
      console.log(`   ⚠️  TRAP: ${testCase.trapInfo}`);
    }
    console.log();

    const result = await runTest(model, testCase);

    if (!result.success) {
      results.push({
        type: testCase.type,
        question: testCase.question,
        response: 'ERROR',
        refused: false,
        passed: false,
      });
      console.log(`   ❌ Test failed with error\n`);
      continue;
    }

    // Determine if test passed
    let passed = false;
    if (testCase.shouldRefuse) {
      // Should refuse to answer
      passed = result.refused;
    } else {
      // Should answer (not refuse)
      passed = !result.refused;
    }

    results.push({
      type: testCase.type,
      question: testCase.question,
      response: result.response,
      refused: result.refused,
      passed,
    });

    console.log(`   📝 Response: "${result.response}"`);
    console.log(`   🔍 Refused: ${result.refused ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  }

  // Print results table
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        Test Results                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('┌────────────────────────────────┬──────────┬────────┐');
  console.log('│ Test Type                      │ Refused  │ Status │');
  console.log('├────────────────────────────────┼──────────┼────────┤');

  for (const result of results) {
    const statusEmoji = result.passed ? '✅ PASS' : '❌ FAIL';
    const typePadded = result.type.padEnd(30);
    const refusedPadded = (result.refused ? 'YES' : 'NO').padEnd(8);

    console.log(`│ ${typePadded} │ ${refusedPadded} │ ${statusEmoji} │`);
  }

  console.log('└────────────────────────────────┴──────────┴────────┘\n');

  // Print detailed responses
  console.log('📊 Detailed Responses:\n');
  for (let i = 0; i < results.length; i++) {
    console.log(`${i + 1}. ${results[i].type}:`);
    console.log(`   Question: ${results[i].question}`);
    console.log(`   Response: ${results[i].response}\n`);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                           Summary                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (passedCount === totalCount) {
    console.log(`✅ All tests passed! (${passedCount}/${totalCount})`);
    console.log('🎉 Zero Hallucination Strategy is working correctly.');
    console.log('✅ Radical Uncertainty rule: AI refuses to use external knowledge.\n');
  } else {
    console.log(`⚠️  Some tests failed: ${passedCount}/${totalCount} passed`);
    console.log('🔧 Review the RAG prompt rules or test expectations.\n');

    // Specific feedback for failed tests
    const failedTests = results.filter((r) => !r.passed);
    if (failedTests.some((t) => t.type.includes('Trap') && !t.refused)) {
      console.log('⚠️  CRITICAL: AI is hallucinating! It answered a question using external knowledge.');
      console.log('   This violates the Radical Uncertainty rule.');
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

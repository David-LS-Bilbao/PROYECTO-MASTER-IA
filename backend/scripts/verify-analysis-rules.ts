/**
 * Verification Script: Evidence-Based Scoring Rules
 *
 * Tests if the updated ANALYSIS_PROMPT correctly penalizes opinions
 * and rewards fact-based articles with verifiable sources.
 *
 * Usage: npx tsx backend/scripts/verify-analysis-rules.ts
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
import { ANALYSIS_PROMPT } from '../src/infrastructure/external/prompts/analysis.prompt';

// Test cases
const testCases = [
  {
    type: 'Opinion/Low Quality',
    title: 'La crisis política que nadie quiere ver',
    source: 'Blog Anónimo',
    content:
      'Esto es un desastre. Los políticos nos arruinan y nadie hace nada. Se siente en la calle. La gente está harta de tanta corrupción y mentiras. Todo el mundo lo sabe pero nadie se atreve a decirlo.',
    expectedScore: '< 50',
    expectedReason: 'Opinión sin datos, lenguaje emocional, sin fuentes',
  },
  {
    type: 'Fact/High Quality',
    title: 'El IPC sube un 2.1% en marzo',
    source: 'Agencia EFE',
    content:
      'El IPC subió un 2.1% en marzo según datos publicados hoy por el INE (Instituto Nacional de Estadística). El organismo oficial destacó que el incremento se debe principalmente al aumento de los precios energéticos. Según el informe mensual del INE, la inflación subyacente se situó en el 1.8%, dos décimas menos que en febrero.',
    expectedScore: '> 80',
    expectedReason: 'Cita organismo oficial (INE), datos específicos, sin opinión',
  },
];

interface AnalysisResult {
  internal_reasoning: string;
  summary: string;
  category: string;
  biasScore: number;
  reliabilityScore: number;
  suggestedTopics: string[];
  analysis: {
    biasType: string;
    explanation: string;
  };
}

async function runTest(
  model: any,
  testCase: (typeof testCases)[0]
): Promise<{ success: boolean; score: number; reasoning: string }> {
  try {
    // Build prompt with test data
    const prompt = ANALYSIS_PROMPT.replace('{title}', testCase.title)
      .replace('{source}', testCase.source)
      .replace('{content}', testCase.content);

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Clean up potential markdown formatting
    let cleanText = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Parse JSON response
    const parsed: AnalysisResult = JSON.parse(cleanText);

    return {
      success: true,
      score: parsed.reliabilityScore,
      reasoning: parsed.internal_reasoning,
    };
  } catch (error) {
    console.error(`   ❌ Error processing test case: ${(error as Error).message}`);
    return {
      success: false,
      score: -1,
      reasoning: 'ERROR',
    };
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║       Evidence-Based Scoring Verification Test                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize Gemini model
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  console.log('📋 Running test cases...\n');

  // Results table
  const results: Array<{
    type: string;
    score: number;
    expected: string;
    passed: boolean;
    reasoning: string;
  }> = [];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.type}`);
    console.log(`   Title: "${testCase.title}"`);
    console.log(`   Expected: reliabilityScore ${testCase.expectedScore}\n`);

    const result = await runTest(model, testCase);

    if (!result.success) {
      results.push({
        type: testCase.type,
        score: -1,
        expected: testCase.expectedScore,
        passed: false,
        reasoning: 'ERROR',
      });
      continue;
    }

    // Check if score meets expectations
    let passed = false;
    if (testCase.expectedScore.startsWith('<')) {
      const threshold = parseInt(testCase.expectedScore.replace('< ', ''));
      passed = result.score < threshold;
    } else if (testCase.expectedScore.startsWith('>')) {
      const threshold = parseInt(testCase.expectedScore.replace('> ', ''));
      passed = result.score > threshold;
    }

    results.push({
      type: testCase.type,
      score: result.score,
      expected: testCase.expectedScore,
      passed,
      reasoning: result.reasoning,
    });

    console.log(`   ✅ Received score: ${result.score}`);
    console.log(`   📝 Reasoning: ${result.reasoning}\n`);
  }

  // Print results table
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                        Test Results                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('┌─────────────────────────┬───────┬──────────┬────────┐');
  console.log('│ Input Type              │ Score │ Expected │ Status │');
  console.log('├─────────────────────────┼───────┼──────────┼────────┤');

  for (const result of results) {
    const statusEmoji = result.passed ? '✅ PASS' : '❌ FAIL';
    const typePadded = result.type.padEnd(23);
    const scorePadded = String(result.score).padEnd(5);
    const expectedPadded = result.expected.padEnd(8);

    console.log(`│ ${typePadded} │ ${scorePadded} │ ${expectedPadded} │ ${statusEmoji} │`);
  }

  console.log('└─────────────────────────┴───────┴──────────┴────────┘\n');

  // Print reasoning details
  console.log('📊 Detailed Reasoning:\n');
  for (let i = 0; i < results.length; i++) {
    console.log(`${i + 1}. ${results[i].type}:`);
    console.log(`   ${results[i].reasoning}\n`);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                           Summary                              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (passedCount === totalCount) {
    console.log(`✅ All tests passed! (${passedCount}/${totalCount})`);
    console.log('🎉 Evidence-Based Scoring is working correctly.\n');
  } else {
    console.log(`⚠️  Some tests failed: ${passedCount}/${totalCount} passed`);
    console.log('🔧 Review the prompt rules or test expectations.\n');
  }
}

main().catch((err) => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});

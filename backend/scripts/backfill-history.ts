/**
 * Backfill historical news using Google News RSS date operators.
 *
 * Usage:
 *   npx tsx backend/scripts/backfill-history.ts
 *
 * Notes:
 * - Runs sequentially to reduce 429 rate-limit errors.
 * - Uses Google query operators:
 *   "<topic> after:YYYY-MM-DD before:YYYY-MM-DD"
 */

import dotenv from 'dotenv';
import path from 'path';

import { IngestNewsUseCase } from '../src/application/use-cases/ingest-news.usecase';
import { GoogleNewsRssClient } from '../src/infrastructure/external/google-news-rss.client';
import { PrismaNewsArticleRepository } from '../src/infrastructure/persistence/prisma-news-article.repository';
import { getPrismaClient } from '../src/infrastructure/persistence/prisma.client';

dotenv.config({ path: path.join(__dirname, '../.env') });

const LOOKBACK_DAYS = 7;
const REQUEST_DELAY_MS = 3000;
const PAGE_SIZE = 30;
const SKIP_AI_ANALYSIS = true;

type TopicConfig = {
  label: string;
  category: string;
  queryToken: string;
  topicSlug?: string;
};

const TOPICS: TopicConfig[] = [
  { label: 'tecnologia', category: 'tecnologia', queryToken: 'tecnologia', topicSlug: 'ciencia-tecnologia' },
  { label: 'ciencia', category: 'ciencia', queryToken: 'ciencia', topicSlug: 'ciencia-tecnologia' },
  { label: 'salud', category: 'salud', queryToken: 'salud', topicSlug: 'salud' },
  { label: 'economia', category: 'economia', queryToken: 'economia', topicSlug: 'economia' },
  { label: 'deportes', category: 'deportes', queryToken: 'deportes', topicSlug: 'deportes' },
  // "nacional" is mapped to the valid backend category "espana".
  { label: 'nacional', category: 'espana', queryToken: 'nacional', topicSlug: 'espana' },
  { label: 'internacional', category: 'internacional', queryToken: 'internacional', topicSlug: 'internacional' },
];

const LOCAL_CITIES: string[] = ['Madrid', 'Bilbao', 'Barcelona'];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function getDayWindow(daysAgo: number): { startDate: Date; endDate: Date } {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - daysAgo);

  const endDate = new Date(startDate);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

function buildGoogleDateQuery(token: string, startDate: Date, endDate: Date): string {
  // Google "before:" behaves as an upper bound; add 1 day to include full target day.
  const beforeDate = new Date(endDate);
  beforeDate.setDate(beforeDate.getDate() + 1);

  return `${token} after:${formatDate(startDate)} before:${formatDate(beforeDate)}`;
}

type PatchedUseCase = {
  getSmartQuery?: (category: string | undefined, fallbackQuery: string | undefined) => string | undefined;
};

function forceUseCaseToRespectProvidedQuery(useCase: IngestNewsUseCase): () => void {
  const mutableUseCase = useCase as unknown as PatchedUseCase;
  const original = mutableUseCase.getSmartQuery;

  // Backfill must keep the raw Google query with after/before operators.
  mutableUseCase.getSmartQuery = (_category, fallbackQuery) => fallbackQuery;

  return () => {
    mutableUseCase.getSmartQuery = original;
  };
}

async function ingestTopicForDay(
  ingestUseCase: IngestNewsUseCase,
  dayIndex: number,
  topic: TopicConfig,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const query = buildGoogleDateQuery(topic.queryToken, startDate, endDate);
  const dayTag = formatDate(startDate);

  try {
    const result = await ingestUseCase.execute({
      category: topic.category,
      topicSlug: topic.topicSlug,
      query,
      language: 'es',
      pageSize: PAGE_SIZE,
    });

    console.log(`[DIA ${dayIndex}] Ingestando categoria '${topic.label}'... Encontradas: ${result.totalFetched} noticias.`);
    return result.totalFetched;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fallo en [${dayTag}] [${topic.label}]... ${message}`);
    return 0;
  }
}

async function ingestLocalForDay(
  ingestUseCase: IngestNewsUseCase,
  dayIndex: number,
  city: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  const query = buildGoogleDateQuery(city, startDate, endDate);
  const dayTag = formatDate(startDate);

  try {
    const result = await ingestUseCase.execute({
      category: 'local',
      topicSlug: 'local',
      query,
      language: 'es',
      pageSize: PAGE_SIZE,
    });

    console.log(`[DIA ${dayIndex}] Ingestando categoria 'local:${city}'... Encontradas: ${result.totalFetched} noticias.`);
    return result.totalFetched;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fallo en [${dayTag}] [local:${city}]... ${message}`);
    return 0;
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Configure backend/.env first.');
    process.exit(1);
  }

  const prisma = getPrismaClient();
  const repository = new PrismaNewsArticleRepository(prisma);
  const googleClient = new GoogleNewsRssClient();
  const ingestUseCase = new IngestNewsUseCase(
    googleClient,
    repository,
    prisma,
    googleClient
  );

  const restoreSmartQuery = forceUseCaseToRespectProvidedQuery(ingestUseCase);

  let totalFound = 0;
  let totalRequests = 0;

  console.log(`Starting historical backfill for last ${LOOKBACK_DAYS} days...`);
  console.log(`Topics: ${TOPICS.map((t) => t.label).join(', ')}`);
  if (LOCAL_CITIES.length > 0) {
    console.log(`Local cities: ${LOCAL_CITIES.join(', ')}`);
  }
  console.log(`Delay between requests: ${REQUEST_DELAY_MS}ms\n`);
  if (SKIP_AI_ANALYSIS) {
    console.log("SKIP_AI_ANALYSIS=true (IngestNewsUseCase ya guarda datos crudos y no ejecuta analisis con Gemini en este flujo).\n");
  }

  try {
    for (let i = 0; i < LOOKBACK_DAYS; i++) {
      const dayNumber = i + 1;
      const { startDate, endDate } = getDayWindow(i);

      console.log(
        `=== [DIA ${dayNumber}] ${startDate.toISOString()} -> ${endDate.toISOString()} ===`
      );

      for (const topic of TOPICS) {
        const found = await ingestTopicForDay(ingestUseCase, dayNumber, topic, startDate, endDate);
        totalFound += found;
        totalRequests += 1;
        await wait(REQUEST_DELAY_MS);
      }

      for (const city of LOCAL_CITIES) {
        const found = await ingestLocalForDay(ingestUseCase, dayNumber, city, startDate, endDate);
        totalFound += found;
        totalRequests += 1;
        await wait(REQUEST_DELAY_MS);
      }

      console.log('');
    }

    console.log('Backfill completed.');
    console.log(`Total requests: ${totalRequests}`);
    console.log(`Total fetched (sum): ${totalFound}`);
  } finally {
    restoreSmartQuery();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error in backfill-history:', error);
  process.exit(1);
});

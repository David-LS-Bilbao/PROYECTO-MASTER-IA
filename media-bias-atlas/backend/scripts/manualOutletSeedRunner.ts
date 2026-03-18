import dotenv from 'dotenv';
import path from 'path';
import Parser from 'rss-parser';
import { PrismaClient } from '@prisma/client';

import {
  ManualCountrySeed,
  ManualOutletSeed,
  ManualRssFeedSeed,
} from './data/manualOutletSeedTypes';

const parser = new Parser({
  timeout: 10_000,
  headers: {
    'User-Agent': 'MediaBiasAtlasSeed/1.0 (+local-demo)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  },
});

type UpsertAction = 'created' | 'updated';

export interface ManualSeedRunnerOptions {
  validateOnly?: boolean;
}

interface FeedValidationResult {
  ok: boolean;
  title?: string;
  items?: number;
  error?: string;
}

export function loadSeedEnv() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../.env.example'), override: false });
}

async function ensureCountry(prisma: PrismaClient, seed: ManualCountrySeed) {
  return prisma.country.upsert({
    where: { code: seed.country.code },
    update: { name: seed.country.name },
    create: seed.country,
  });
}

async function ensureOutlet(prisma: PrismaClient, countryId: string, outletSeed: ManualOutletSeed) {
  const existing = await prisma.outlet.findFirst({
    where: {
      countryId,
      OR: [
        { websiteUrl: outletSeed.websiteUrl },
        { name: { equals: outletSeed.name, mode: 'insensitive' } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    const outlet = await prisma.outlet.update({
      where: { id: existing.id },
      data: {
        name: outletSeed.name,
        description: outletSeed.description,
        websiteUrl: outletSeed.websiteUrl,
      },
    });

    return { outlet, action: 'updated' as UpsertAction };
  }

  const outlet = await prisma.outlet.create({
    data: {
      countryId,
      name: outletSeed.name,
      description: outletSeed.description,
      websiteUrl: outletSeed.websiteUrl,
    },
  });

  return { outlet, action: 'created' as UpsertAction };
}

async function validateFeed(candidate: ManualRssFeedSeed): Promise<FeedValidationResult> {
  try {
    const feed = await parser.parseURL(candidate.url);
    const items = feed.items?.length ?? 0;

    if (!feed.title && items === 0) {
      return {
        ok: false,
        error: 'El feed responde pero no contiene metadatos ni items suficientes.',
      };
    }

    return {
      ok: true,
      title: feed.title ?? '(sin título)',
      items,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function ensureFeed(prisma: PrismaClient, outletId: string, feedSeed: ManualRssFeedSeed) {
  const existing = await prisma.rssFeed.findFirst({
    where: {
      outletId,
      url: feedSeed.url,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    const feed = await prisma.rssFeed.update({
      where: { id: existing.id },
      data: {
        category: feedSeed.category,
        isActive: true,
      },
    });

    return { feed, action: 'updated' as UpsertAction };
  }

  const feed = await prisma.rssFeed.create({
    data: {
      outletId,
      url: feedSeed.url,
      category: feedSeed.category,
      isActive: true,
    },
  });

  return { feed, action: 'created' as UpsertAction };
}

export async function runManualCountrySeed(
  prisma: PrismaClient,
  seed: ManualCountrySeed,
  options: ManualSeedRunnerOptions = {}
) {
  const validateOnly = options.validateOnly === true;

  console.log(
    `--- Seed manual ${validateOnly ? 'VALIDATE-ONLY' : 'APPLY'} ${seed.country.code} (${seed.country.name}) ---`
  );

  let countryId: string | null = null;

  if (!validateOnly) {
    const country = await ensureCountry(prisma, seed);
    countryId = country.id;
    console.log(`País listo: ${country.code} - ${country.name}`);
  }

  const summary = {
    validateOnly,
    countryCode: seed.country.code,
    outletsCreated: 0,
    outletsUpdated: 0,
    feedsCreated: 0,
    feedsUpdated: 0,
    validatedFeeds: 0,
    feedsRejected: [] as Array<{ outlet: string; label: string; url: string; reason: string }>,
  };

  for (const outletSeed of seed.outlets) {
    let outletAction: UpsertAction | 'validated' = 'validated';
    let outletId: string | null = null;

    if (!validateOnly && countryId) {
      const ensured = await ensureOutlet(prisma, countryId, outletSeed);
      outletAction = ensured.action;
      outletId = ensured.outlet.id;
      summary[ensured.action === 'created' ? 'outletsCreated' : 'outletsUpdated'] += 1;
    }

    console.log(`\n[${outletSeed.name}] outlet ${outletAction}`);

    for (const feedSeed of outletSeed.feeds) {
      const validation = await validateFeed(feedSeed);

      if (!validation.ok) {
        summary.feedsRejected.push({
          outlet: outletSeed.name,
          label: feedSeed.label,
          url: feedSeed.url,
          reason: validation.error ?? 'Validación fallida',
        });

        console.log(
          `  - Feed rechazado: ${feedSeed.label} -> ${feedSeed.url} (${validation.error ?? 'error desconocido'})`
        );
        continue;
      }

      summary.validatedFeeds += 1;

      if (validateOnly || !outletId) {
        console.log(
          `  - Feed validado: ${feedSeed.label} (${feedSeed.category}) -> ${validation.title} [items=${validation.items ?? 0}]`
        );
        continue;
      }

      const { action: feedAction } = await ensureFeed(prisma, outletId, feedSeed);
      summary[feedAction === 'created' ? 'feedsCreated' : 'feedsUpdated'] += 1;

      console.log(
        `  - Feed ${feedAction}: ${feedSeed.label} (${feedSeed.category}) -> ${validation.title} [items=${validation.items ?? 0}]`
      );
    }
  }

  console.log('\n--- Pendientes de revisión manual ---');
  for (const pending of seed.pending) {
    console.log(`- ${pending.name}: ${pending.reason}`);
  }

  console.log(`\n--- Resumen seed ${seed.country.code} ---`);
  console.log(`Outlets creados: ${summary.outletsCreated}`);
  console.log(`Outlets actualizados: ${summary.outletsUpdated}`);
  console.log(`Feeds creados: ${summary.feedsCreated}`);
  console.log(`Feeds actualizados: ${summary.feedsUpdated}`);
  console.log(`Feeds validados: ${summary.validatedFeeds}`);
  console.log(`Feeds rechazados: ${summary.feedsRejected.length}`);

  if (summary.feedsRejected.length > 0) {
    for (const rejected of summary.feedsRejected) {
      console.log(`  * ${rejected.outlet} / ${rejected.label}: ${rejected.reason}`);
    }
  }

  if (summary.validatedFeeds === 0) {
    throw new Error('No se ha validado ningún feed. Revisa conectividad o URLs.');
  }

  return summary;
}

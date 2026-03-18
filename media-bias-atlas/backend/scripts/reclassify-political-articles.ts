import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import { ClassifyPoliticalArticleUseCase } from '../src/application/use-cases/classification/ClassifyPoliticalArticleUseCase';
import { BiasAnalysisStatus } from '../src/domain/entities/ArticleBiasAnalysis';
import { ClassificationStatus } from '../src/domain/entities/Article';

const prisma = new PrismaClient();

const INVALIDATED_ANALYSIS_MESSAGE =
  'Análisis invalidado tras reclasificación: el artículo ya no se considera político.';

type CliOptions = {
  countryCode?: string;
  apply: boolean;
  limit?: number;
};

type ClassificationPayload = {
  isPolitical: boolean | null;
  classificationStatus: ClassificationStatus;
  classificationReason: string;
  classifiedAt: Date;
};

function loadEnv() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  dotenv.config({ path: path.resolve(__dirname, '../.env.example'), override: false });
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg.startsWith('--country=')) {
      options.countryCode = arg.slice('--country='.length).trim().toUpperCase();
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.slice('--limit='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
      }
    }
  }

  return options;
}

function buildClassificationPayload(
  classifier: ClassifyPoliticalArticleUseCase,
  title: string,
  now: Date
): ClassificationPayload {
  if (!title.trim()) {
    return {
      isPolitical: null,
      classificationStatus: ClassificationStatus.FAILED,
      classificationReason: 'Texto vacío o nulo',
      classifiedAt: now,
    };
  }

  const result = classifier.analyzeText(title);
  return {
    isPolitical: result.isPolitical,
    classificationStatus: result.classificationStatus,
    classificationReason: result.classificationReason,
    classifiedAt: now,
  };
}

function shouldInvalidateAnalysis(
  analysis:
    | {
        status: BiasAnalysisStatus;
        provider: string | null;
        model: string | null;
        ideologyLabel: string | null;
        confidence: number | null;
        summary: string | null;
        reasoningShort: string | null;
        rawJson: string | null;
        errorMessage: string | null;
        analyzedAt: Date | null;
      }
    | null
    | undefined
): boolean {
  if (!analysis) {
    return false;
  }

  if (analysis.status !== BiasAnalysisStatus.FAILED) {
    return true;
  }

  return (
    analysis.provider !== null ||
    analysis.model !== null ||
    analysis.ideologyLabel !== null ||
    analysis.confidence !== null ||
    analysis.summary !== null ||
    analysis.reasoningShort !== null ||
    analysis.rawJson !== null ||
    analysis.analyzedAt !== null ||
    analysis.errorMessage !== INVALIDATED_ANALYSIS_MESSAGE
  );
}

async function main() {
  loadEnv();

  const options = parseArgs(process.argv.slice(2));
  const classifier = new ClassifyPoliticalArticleUseCase({} as any);

  const where = options.countryCode
    ? {
        feed: {
          outlet: {
            country: {
              code: options.countryCode,
            },
          },
        },
      }
    : {};

  const articles = await prisma.article.findMany({
    where,
    include: {
      biasAnalysis: true,
      feed: {
        include: {
          outlet: {
            include: {
              country: true,
            },
          },
        },
      },
    },
    orderBy: {
      publishedAt: 'desc',
    },
    ...(typeof options.limit === 'number' ? { take: options.limit } : {}),
  });

  const summary = {
    dryRun: !options.apply,
    countryCode: options.countryCode ?? 'ALL',
    processed: 0,
    classificationUpdated: 0,
    trueToFalse: 0,
    falseToTrue: 0,
    nullToClassified: 0,
    analysisInvalidated: 0,
    unchanged: 0,
    samples: [] as Array<{
      articleId: string;
      title: string;
      outlet: string;
      beforePolitical: boolean | null;
      afterPolitical: boolean | null;
      previousReason: string | null;
      nextReason: string;
      invalidatedAnalysis: boolean;
    }>,
  };

  console.log(
    `--- Reclasificación política ${options.apply ? 'APPLY' : 'DRY-RUN'} (${summary.countryCode}) ---`
  );

  for (const article of articles) {
    summary.processed += 1;
    const now = new Date();
    const nextClassification = buildClassificationPayload(classifier, article.title, now);

    const classificationChanged =
      article.isPolitical !== nextClassification.isPolitical ||
      article.classificationStatus !== nextClassification.classificationStatus ||
      article.classificationReason !== nextClassification.classificationReason;

    const invalidatesAnalysis = nextClassification.isPolitical !== true && shouldInvalidateAnalysis(article.biasAnalysis);

    if (!classificationChanged && !invalidatesAnalysis) {
      summary.unchanged += 1;
      continue;
    }

    if (article.isPolitical === true && nextClassification.isPolitical === false) {
      summary.trueToFalse += 1;
    } else if (article.isPolitical === false && nextClassification.isPolitical === true) {
      summary.falseToTrue += 1;
    } else if (article.isPolitical === null && nextClassification.isPolitical !== null) {
      summary.nullToClassified += 1;
    }

    if (classificationChanged) {
      summary.classificationUpdated += 1;
    }

    if (invalidatesAnalysis) {
      summary.analysisInvalidated += 1;
    }

    if (summary.samples.length < 20) {
      summary.samples.push({
        articleId: article.id,
        title: article.title,
        outlet: article.feed.outlet.name,
        beforePolitical: article.isPolitical,
        afterPolitical: nextClassification.isPolitical,
        previousReason: article.classificationReason,
        nextReason: nextClassification.classificationReason,
        invalidatedAnalysis: invalidatesAnalysis,
      });
    }

    if (!options.apply) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      if (classificationChanged) {
        await tx.article.update({
          where: { id: article.id },
          data: {
            isPolitical: nextClassification.isPolitical,
            classificationStatus: nextClassification.classificationStatus,
            classificationReason: nextClassification.classificationReason,
            classifiedAt: nextClassification.classifiedAt,
          },
        });
      }

      if (invalidatesAnalysis) {
        await tx.articleBiasAnalysis.update({
          where: { articleId: article.id },
          data: {
            status: BiasAnalysisStatus.FAILED,
            provider: null,
            model: null,
            ideologyLabel: null,
            confidence: null,
            summary: null,
            reasoningShort: null,
            rawJson: null,
            errorMessage: INVALIDATED_ANALYSIS_MESSAGE,
            analyzedAt: null,
          },
        });
      }
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('Error durante la reclasificación política de mantenimiento:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

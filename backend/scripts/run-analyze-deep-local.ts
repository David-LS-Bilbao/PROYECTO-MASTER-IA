/**
 * Run deep analysis through AnalyzeController with a mocked authenticated request.
 *
 * Why this script:
 * - /api/analyze/article requires Firebase auth token.
 * - For local QA without exposing tokens, this script executes the same controller
 *   and error-handler path and prints HTTP-like status/payload.
 *
 * Usage:
 *   npx ts-node scripts/run-analyze-deep-local.ts --articleId <UUID>
 */

import path from 'path';
import dotenv from 'dotenv';
import type { Request, Response, NextFunction } from 'express';
import { DependencyContainer } from '../src/infrastructure/config/dependencies';
import { errorHandler } from '../src/infrastructure/http/middleware/error.handler';
import '../src/infrastructure/http/middleware/auth.middleware';

dotenv.config({ path: path.join(__dirname, '../.env') });

type Args = {
  articleId?: string;
};

type MockResponseShape = {
  statusCode: number;
  headers: Record<string, string>;
  payload: unknown;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => MockResponseShape;
  json: (payload: unknown) => MockResponseShape;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--articleId') {
      args.articleId = argv[i + 1];
      i += 1;
    }
  }

  return args;
}

function createMockResponse(): MockResponseShape {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.articleId) {
    console.error('Missing --articleId <UUID>');
    process.exitCode = 1;
    return;
  }

  const container = DependencyContainer.getInstance();
  await container.prisma.user.upsert({
    where: { id: 'local-audit-user' },
    update: {
      email: 'local-audit@example.com',
      subscriptionPlan: 'PREMIUM',
      preferences: {
        entitlements: {
          deepAnalysis: true,
        },
      },
      usageStats: {},
      updatedAt: new Date(),
    },
    create: {
      id: 'local-audit-user',
      email: 'local-audit@example.com',
      name: 'Local Audit',
      picture: null,
      subscriptionPlan: 'PREMIUM',
      preferences: {
        entitlements: {
          deepAnalysis: true,
        },
      },
      usageStats: {},
    },
  });

  const res = createMockResponse();

  const req = {
    body: {
      articleId: args.articleId,
      mode: 'deep',
    },
    headers: {
      'x-request-id': `local-audit-${Date.now()}`,
    },
    path: '/api/analyze/article',
    method: 'POST',
    user: {
      uid: 'local-audit-user',
      email: 'local-audit@example.com',
      name: 'Local Audit',
      picture: null,
      subscriptionPlan: 'PREMIUM',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      entitlements: {
        deepAnalysis: true,
      },
      preferences: {
        entitlements: {
          deepAnalysis: true,
        },
      },
      usageStats: {
        currentMonthUsage: 0,
      },
    },
  } as unknown as Request;

  try {
    await container.analyzeController.analyzeArticle(
      req,
      res as unknown as Response
    );
  } catch (error) {
    errorHandler(
      error as Error,
      req,
      res as unknown as Response,
      (() => undefined) as NextFunction
    );
  } finally {
    await container.close();
  }

  const payload =
    (res.payload && typeof res.payload === 'object'
      ? (res.payload as Record<string, unknown>)
      : null) ?? null;

  console.log('\nAnalyze deep (controller path)');
  console.log('==============================');
  console.log(`articleId: ${args.articleId}`);
  console.log(`statusCode: ${res.statusCode}`);
  console.log(`contentType: ${res.headers['Content-Type'] || res.headers['content-type'] || 'n/a'}`);
  console.log(`success: ${String((payload as { success?: unknown })?.success ?? false)}`);

  if ((payload as { message?: unknown })?.message) {
    console.log(`message: ${String((payload as { message?: unknown }).message)}`);
  }
  if ((payload as { error?: unknown })?.error) {
    console.log(`error: ${String((payload as { error?: unknown }).error)}`);
  }
  if ((payload as { data?: unknown })?.data) {
    const data = (payload as { data?: unknown }).data as Record<string, unknown>;
    const analysis = ((data.analysis as Record<string, unknown> | undefined) ?? {}) as Record<
      string,
      unknown
    >;
    const summary = typeof analysis.summary === 'string' ? analysis.summary : '';
    console.log(`analysisModeUsed: ${String(analysis.analysisModeUsed ?? 'n/a')}`);
    console.log(`scrapedContentLength: ${String(data.scrapedContentLength ?? 'n/a')}`);
    console.log(`summary.head180: ${summary.slice(0, 180)}`);
    console.log(
      `qualityNotice: ${
        typeof analysis.qualityNotice === 'string' ? analysis.qualityNotice : 'n/a'
      }`
    );
    const deepQuotes = ((analysis.deep as { sections?: { quotes?: unknown } } | undefined)?.sections
      ?.quotes ?? []) as unknown[];
    if (Array.isArray(deepQuotes)) {
      const printable = deepQuotes
        .filter((item): item is string => typeof item === 'string')
        .slice(0, 4)
        .map((item) => item.slice(0, 120));
      console.log(`deepQuotes.preview: ${printable.length > 0 ? printable.join(' | ') : 'n/a'}`);
    }
  }
  if ((payload as { error?: unknown })?.error && typeof (payload as { error?: unknown }).error === 'object') {
    const errorPayload = (payload as { error: Record<string, unknown> }).error;
    const details = errorPayload.details;
    if (details && typeof details === 'object') {
      const detailsObj = details as Record<string, unknown>;
      console.log(`error.service: ${String(detailsObj.service ?? 'n/a')}`);
      console.log(`error.statusCode: ${String(detailsObj.statusCode ?? 'n/a')}`);
      const originalMessage = String(detailsObj.originalMessage ?? '');
      if (originalMessage) {
        console.log(`error.originalMessage.head180: ${originalMessage.slice(0, 180)}`);
      }
    }
  }
}

void run();

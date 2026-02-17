/**
 * Audit script for article analysis input pipeline.
 *
 * It reports:
 * - Stored DB text field lengths (title/description/content/summary/analysis)
 * - Which text would be used for analysis (FULL BODY / EXTRACTED / SNIPPET)
 * - Jina extraction outcome (ok/error + extracted length)
 * - Preview of analyzed text (first 200 + last 200 chars)
 *
 * Usage:
 *   npx ts-node scripts/audit-article-text.ts --list
 *   npx ts-node scripts/audit-article-text.ts --articleId <UUID> [--mode deep|standard] [--skip-jina]
 */

import path from 'path';
import dotenv from 'dotenv';
import type { PrismaClient } from '@prisma/client';
import { JinaReaderClient } from '../src/infrastructure/external/jina-reader.client';
import { getPrismaClient } from '../src/infrastructure/persistence/prisma.client';

dotenv.config({ path: path.join(__dirname, '../.env') });

const MIN_CONTENT_LENGTH = 100;
const AUTO_LOW_COST_CONTENT_THRESHOLD = 800;
const PREVIEW_CHARS = 200;
const INTERNAL_METADATA_LINE_PATTERN =
  /\b(isSuscriberContent|isSubscriberContent|subscriberContent|flags?|ids?|trackingId|contentId|nodeId|assetId)\b/i;

type RequestedMode = 'standard' | 'deep';
type TextSource = 'FULL BODY' | 'EXTRACTED' | 'SNIPPET';

type AuditArgs = {
  articleId?: string;
  mode: RequestedMode;
  skipJina: boolean;
  listOnly: boolean;
};

type AuditResult = {
  textSource: TextSource;
  rawTextUsed: string;
  preparedTextUsed: string;
  contaminationFlags: string[];
  shouldForceRescrapeForDeep: boolean;
  isContentInvalid: boolean;
  extractionAttempted: boolean;
  extractionOk: boolean;
  extractionContentLength: number;
  extractionError: string | null;
};

type ParsedAnalysisSnapshot = {
  analysisModeUsed?: string;
  qualityNotice?: string;
  summary?: string;
  deepUnknown?: string[];
};

function parseArgs(argv: string[]): AuditArgs {
  const args: AuditArgs = {
    mode: 'deep',
    skipJina: false,
    listOnly: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--articleId') {
      args.articleId = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--mode') {
      const value = argv[i + 1];
      if (value === 'standard' || value === 'deep') {
        args.mode = value;
      }
      i += 1;
      continue;
    }
    if (token === '--skip-jina') {
      args.skipJina = true;
      continue;
    }
    if (token === '--list') {
      args.listOnly = true;
      continue;
    }
  }

  return args;
}

function toLength(value: string | null | undefined): number {
  return typeof value === 'string' ? value.length : 0;
}

function previewHead(text: string, chars = PREVIEW_CHARS): string {
  return text.slice(0, chars).replace(/\s+/g, ' ').trim();
}

function previewTail(text: string, chars = PREVIEW_CHARS): string {
  if (text.length <= chars) {
    return text.replace(/\s+/g, ' ').trim();
  }
  return text.slice(-chars).replace(/\s+/g, ' ').trim();
}

function parseAnalysisSnapshot(rawAnalysis: string | null): ParsedAnalysisSnapshot | null {
  if (!rawAnalysis) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawAnalysis) as Record<string, unknown>;
    const deep = parsed.deep as Record<string, unknown> | undefined;
    const sections = deep?.sections as Record<string, unknown> | undefined;
    const unknown = Array.isArray(sections?.unknown)
      ? (sections?.unknown as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];

    return {
      analysisModeUsed:
        typeof parsed.analysisModeUsed === 'string' ? parsed.analysisModeUsed : undefined,
      qualityNotice: typeof parsed.qualityNotice === 'string' ? parsed.qualityNotice : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      deepUnknown: unknown,
    };
  } catch {
    return null;
  }
}

function detectRssSnippet(content: string): boolean {
  if (!content) {
    return false;
  }

  return /\bleer\b/i.test(content) && /<a\s+[^>]*href\s*=/i.test(content);
}

function stripHtmlTags(content: string): string {
  return content.replace(/<[^>]+>/g, ' ');
}

function decodeHtmlEntities(content: string): string {
  const namedEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&aacute;': 'a',
    '&eacute;': 'e',
    '&iacute;': 'i',
    '&oacute;': 'o',
    '&uacute;': 'u',
    '&Aacute;': 'A',
    '&Eacute;': 'E',
    '&Iacute;': 'I',
    '&Oacute;': 'O',
    '&Uacute;': 'U',
    '&ntilde;': 'n',
    '&Ntilde;': 'N',
    '&uuml;': 'u',
    '&Uuml;': 'U',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
  };

  let decoded = content.replace(
    /&(amp|lt|gt|quot|nbsp|aacute|eacute|iacute|oacute|uacute|Aacute|Eacute|Iacute|Oacute|Uacute|ntilde|Ntilde|uuml|Uuml|ldquo|rdquo|lsquo|rsquo|#39);/g,
    (match) => namedEntities[match] ?? match
  );

  decoded = decoded.replace(/&#(\d+);/g, (_match, decimalCode) => {
    const parsedCode = Number.parseInt(decimalCode, 10);
    return Number.isNaN(parsedCode) ? _match : String.fromCodePoint(parsedCode);
  });
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_match, hexCode) => {
    const parsedCode = Number.parseInt(hexCode, 16);
    return Number.isNaN(parsedCode) ? _match : String.fromCodePoint(parsedCode);
  });

  return decoded;
}

function prepareContentForAnalysis(content: string): string {
  if (!content) {
    return '';
  }

  const extractedFromJson = tryExtractTextFromJsonPayload(content);
  const decodedInput = decodeUnicodeEscapes(extractedFromJson ?? content);
  const sanitizedInput = removeKnownMetadataNoise(decodedInput);

  const withAnchorUrls = sanitizedInput.replace(
    /<a\b[^>]*href\s*=\s*['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, anchorText: string) => {
      const decodedAnchorText = decodeHtmlEntities(anchorText)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return decodedAnchorText ? `${decodedAnchorText} (${href})` : href;
    }
  );

  const withoutTags = stripHtmlTags(withAnchorUrls);
  const decoded = decodeHtmlEntities(withoutTags);
  const withoutMetadataNoise = removeKnownMetadataNoise(decoded);

  return withoutMetadataNoise
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function tryExtractTextFromJsonPayload(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return extractFirstTextFieldFromObject(parsed);
  } catch {
    return undefined;
  }
}

function extractFirstTextFieldFromObject(value: unknown, depth: number = 0): string | undefined {
  if (depth > 5 || value == null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const compact = value.replace(/\s+/g, ' ').trim();
    return compact.length >= 40 ? compact : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFirstTextFieldFromObject(item, depth + 1);
      if (nested) {
        return nested;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const preferredKeys = ['content', 'text', 'articleText', 'body', 'rawText', 'description'];
  for (const key of preferredKeys) {
    if (!(key in record)) {
      continue;
    }
    const nested = extractFirstTextFieldFromObject(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  const containerKeys = ['data', 'result', 'payload', 'article'];
  for (const key of containerKeys) {
    if (!(key in record)) {
      continue;
    }
    const nested = extractFirstTextFieldFromObject(record[key], depth + 1);
    if (nested) {
      return nested;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const nested = extractFirstTextFieldFromObject(nestedValue, depth + 1);
    if (nested) {
      return nested;
    }
  }

  return undefined;
}

function removeKnownMetadataNoise(content: string): string {
  if (!content) {
    return '';
  }

  const strippedKeyValuePairs = content
    .replace(
      /=+\s*\{\s*"content"\s*:\s*\{\s*"data"\s*:\s*\{[\s\S]{0,12000}?\}\s*\}\s*=*/gi,
      ' '
    )
    .replace(
      /\{\s*"content"\s*:\s*\{\s*"data"\s*:\s*\{[\s\S]{0,12000}?\}\s*\}\s*\}/gi,
      ' '
    )
    .replace(
      /"?(isSuscriberContent|isSubscriberContent|subscriberContent|flags?|ids?|trackingId|contentId|nodeId|assetId)"?\s*:\s*("[^"]*"|'[^']*'|true|false|null|-?\d+),?/gi,
      ' '
    )
    .replace(/\b[a-z][a-z0-9]*_\d{1,6}\b/gi, ' ')
    .replace(/\b\d{6,}_\d+\b/g, ' ');

  const filteredLines = strippedKeyValuePairs
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) {
        return false;
      }
      if (INTERNAL_METADATA_LINE_PATTERN.test(line) && /[:=]/.test(line)) {
        return false;
      }
      if (/^["'{[]/.test(line) && /[:=]/.test(line) && INTERNAL_METADATA_LINE_PATTERN.test(line)) {
        return false;
      }
      return true;
    });

  return filteredLines.join('\n');
}

function decodeUnicodeEscapes(content: string): string {
  return content
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hexCode) => {
      const parsedCode = Number.parseInt(hexCode, 16);
      return Number.isNaN(parsedCode) ? _match : String.fromCodePoint(parsedCode);
    })
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function detectContentContamination(text: string): string[] {
  const flags: string[] = [];
  const compact = text.trim();

  if (!compact) {
    return flags;
  }

  if (/\bisSuscriberContent\b/i.test(compact)) {
    flags.push('contains_isSuscriberContent');
  }
  if (/\b[a-z][a-z0-9]*_\d{1,6}\b/i.test(compact)) {
    flags.push('contains_id_like_tokens');
  }
  if (/^\s*[{[]/.test(compact) && /"\w+"\s*:/.test(compact)) {
    flags.push('looks_like_json_payload');
  }
  if (/"content"\s*:\s*\{\s*"data"\s*:/i.test(compact)) {
    flags.push('contains_embedded_content_data_json');
  }
  if (/<html[\s>]|<\/(div|p|span|article|section)>/i.test(compact)) {
    flags.push('contains_html_markup');
  }

  return flags;
}

async function resolveTextForAnalysis(params: {
  mode: RequestedMode;
  content: string | null;
  title: string;
  description: string | null;
  url: string;
  skipJina: boolean;
}): Promise<AuditResult> {
  const { mode, content, title, description, url, skipJina } = params;

  const contentToAnalyze = content ?? '';
  const shouldForceRescrapeForDeep =
    mode === 'deep' &&
    !!contentToAnalyze &&
    (contentToAnalyze.length < AUTO_LOW_COST_CONTENT_THRESHOLD ||
      detectRssSnippet(contentToAnalyze));
  const isContentInvalid =
    !contentToAnalyze ||
    contentToAnalyze.length < MIN_CONTENT_LENGTH ||
    contentToAnalyze.includes('JinaReader API Error') ||
    shouldForceRescrapeForDeep;

  let textSource: TextSource = 'FULL BODY';
  let rawTextUsed = contentToAnalyze;
  let extractionAttempted = false;
  let extractionOk = false;
  let extractionContentLength = 0;
  let extractionError: string | null = null;

  if (isContentInvalid) {
    extractionAttempted = true;

    if (!skipJina) {
      try {
        const jina = new JinaReaderClient(process.env.JINA_API_KEY || '');
        const scraped = await jina.scrapeUrl(url);
        if (scraped.content && scraped.content.length >= MIN_CONTENT_LENGTH) {
          rawTextUsed = scraped.content;
          extractionOk = true;
          extractionContentLength = scraped.content.length;
          textSource = 'EXTRACTED';
        } else {
          extractionError = `scraped content too short (${toLength(scraped.content)})`;
        }
      } catch (error) {
        extractionError = error instanceof Error ? error.message : String(error);
      }
    } else {
      extractionError = 'skip-jina enabled';
    }

    if (!extractionOk) {
      rawTextUsed = `${title}\n\n${description || 'Sin descripcion disponible'}`;
      textSource = 'SNIPPET';
    }
  }

  const preparedTextUsed = (() => {
    const prepared = prepareContentForAnalysis(rawTextUsed || '');
    return prepared.trim().length > 0 ? prepared : rawTextUsed;
  })();
  const contaminationFlags = detectContentContamination(preparedTextUsed);

  return {
    textSource,
    rawTextUsed,
    preparedTextUsed,
    contaminationFlags,
    shouldForceRescrapeForDeep,
    isContentInvalid,
    extractionAttempted,
    extractionOk,
    extractionContentLength,
    extractionError,
  };
}

function printLatestArticles(prisma: PrismaClient): Promise<void> {
  return prisma.article
    .findMany({
      take: 5,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        title: true,
        source: true,
        publishedAt: true,
        description: true,
        content: true,
        url: true,
        analyzedAt: true,
      },
    })
    .then((articles) => {
      console.log('\nLatest 5 articles');
      console.log('=================');
      for (const article of articles) {
        console.log(`- id: ${article.id}`);
        console.log(`  title: ${article.title}`);
        console.log(`  source: ${article.source}`);
        console.log(`  publishedAt: ${article.publishedAt.toISOString()}`);
        console.log(`  descLen: ${toLength(article.description)} | contentLen: ${toLength(article.content)}`);
        console.log(`  analyzed: ${article.analyzedAt ? 'yes' : 'no'}`);
        console.log(`  url: ${article.url}`);
      }
      console.log(
        '\nTip: run with --articleId <UUID> to inspect one article in detail.\n'
      );
    });
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prisma = getPrismaClient();

  try {
    if (args.listOnly || !args.articleId) {
      await printLatestArticles(prisma);
      if (!args.articleId) {
        return;
      }
    }

    const article = await prisma.article.findUnique({
      where: { id: args.articleId },
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        summary: true,
        analysis: true,
        source: true,
        url: true,
        publishedAt: true,
        analyzedAt: true,
      },
    });

    if (!article) {
      console.error(`Article not found: ${args.articleId}`);
      process.exitCode = 1;
      return;
    }

    const audit = await resolveTextForAnalysis({
      mode: args.mode,
      content: article.content,
      title: article.title,
      description: article.description,
      url: article.url,
      skipJina: args.skipJina,
    });

    console.log('\nArticle audit');
    console.log('=============');
    console.log(`id: ${article.id}`);
    console.log(`title: ${article.title}`);
    console.log(`source: ${article.source}`);
    console.log(`publishedAt: ${article.publishedAt.toISOString()}`);
    console.log(`url: ${article.url}`);
    console.log(`alreadyAnalyzed: ${article.analyzedAt ? 'yes' : 'no'}`);

    console.log('\nDB field lengths');
    console.log('----------------');
    console.log(`titleLen: ${toLength(article.title)}`);
    console.log(`descriptionLen: ${toLength(article.description)}`);
    console.log(`contentLen: ${toLength(article.content)}`);
    console.log(`summaryLen: ${toLength(article.summary)}`);
    console.log(`analysisJsonLen: ${toLength(article.analysis)}`);

    const analysisSnapshot = parseAnalysisSnapshot(article.analysis);
    if (analysisSnapshot) {
      console.log('\nExisting analysis snapshot');
      console.log('-------------------------');
      console.log(`analysisModeUsed: ${analysisSnapshot.analysisModeUsed ?? 'n/a'}`);
      console.log(`qualityNotice: ${analysisSnapshot.qualityNotice ?? 'n/a'}`);
      console.log(`summary.head200: ${previewHead(analysisSnapshot.summary || '')}`);
      console.log(
        `deepUnknown[0].head200: ${previewHead(analysisSnapshot.deepUnknown?.[0] || '')}`
      );
    }

    console.log('\nDB previews (sanitized)');
    console.log('-----------------------');
    console.log(`description.head200: ${previewHead(article.description || '')}`);
    console.log(`description.tail200: ${previewTail(article.description || '')}`);
    console.log(`content.head200: ${previewHead(article.content || '')}`);
    console.log(`content.tail200: ${previewTail(article.content || '')}`);

    console.log('\nPipeline decision');
    console.log('-----------------');
    console.log(`requestedMode: ${args.mode}`);
    console.log(`shouldForceRescrapeForDeep: ${audit.shouldForceRescrapeForDeep}`);
    console.log(`isContentInvalid: ${audit.isContentInvalid}`);
    console.log(`extractionAttempted: ${audit.extractionAttempted}`);
    console.log(`extractionOk: ${audit.extractionOk}`);
    console.log(`extractionContentLength: ${audit.extractionContentLength}`);
    console.log(`extractionError: ${audit.extractionError ?? 'none'}`);
    console.log(`textSourceUsedForAnalysis: ${audit.textSource}`);
    console.log(
      `contaminationFlags: ${
        audit.contaminationFlags.length > 0 ? audit.contaminationFlags.join(', ') : 'none'
      }`
    );

    console.log('\nAnalyzed text preview');
    console.log('---------------------');
    console.log(`preparedLen: ${audit.preparedTextUsed.length}`);
    console.log(`prepared.head200: ${previewHead(audit.preparedTextUsed)}`);
    console.log(`prepared.tail200: ${previewTail(audit.preparedTextUsed)}`);
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

void run();

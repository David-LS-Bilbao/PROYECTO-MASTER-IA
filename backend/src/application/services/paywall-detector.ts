import { ArticleAccessStatus } from '../../domain/entities/news-article.entity';

export interface DetectPaywallInput {
  sourceDomain?: string | null;
  metadataFlags?: Record<string, unknown> | null;
  extractedText?: string | null;
  rawContent?: string | null;
  snippet?: string | null;
  extractionFailed?: boolean;
}

export interface DetectPaywallResult {
  accessStatus: ArticleAccessStatus;
  accessReason: string;
  analysisBlocked: boolean;
  confidence: 'strong' | 'medium' | 'none';
}

const PAYWALL_KEYWORDS_ES = [
  'suscribete',
  'suscripcion',
  'suscriptor',
  'hazte suscriptor',
  'solo para suscriptores',
  'contenido para suscriptores',
  'accede con tu suscripcion',
  'continua leyendo',
  'inicia sesion',
  'registrate',
  'contenido exclusivo',
  'para seguir leyendo',
] as const;

const PROBABLE_PAYWALL_DOMAINS = [
  'elpais.com',
  'elmundo.es',
  'expansion.com',
  'abc.es',
  'lavanguardia.com',
  'elconfidencial.com',
  'elespanol.com',
  'wsj.com',
  'ft.com',
  'nytimes.com',
] as const;

const STRONG_MIN_CHARS = 120;
const SHORT_SNIPPET_MAX_CHARS = 320;
const PUBLIC_TEXT_MIN_CHARS = 800;

export function detectPaywall(input: DetectPaywallInput): DetectPaywallResult {
  const normalizedDomain = normalizeDomain(input.sourceDomain);
  const normalizedExtracted = normalizeText(input.extractedText);
  const normalizedRaw = normalizeText(input.rawContent);
  const normalizedSnippet = normalizeText(input.snippet);

  const metadataPaywall = hasSubscriberMetadataFlag(input.metadataFlags);
  if (metadataPaywall) {
    return {
      accessStatus: 'PAYWALLED',
      accessReason: 'metadata_subscriber_flag',
      analysisBlocked: true,
      confidence: 'strong',
    };
  }

  const paywallKeyword =
    findPaywallKeyword(normalizedExtracted) ||
    findPaywallKeyword(normalizedRaw);
  if (paywallKeyword) {
    return {
      accessStatus: 'PAYWALLED',
      accessReason: `keyword:${paywallKeyword}`,
      analysisBlocked: true,
      confidence: 'strong',
    };
  }

  const extractionMissing =
    input.extractionFailed === true || normalizedExtracted.length < STRONG_MIN_CHARS;
  const snippetShort = normalizedSnippet.length > 0 && normalizedSnippet.length < SHORT_SNIPPET_MAX_CHARS;
  const probablePaywallDomain = isProbablePaywallDomain(normalizedDomain);

  if (extractionMissing && snippetShort && probablePaywallDomain) {
    return {
      accessStatus: 'RESTRICTED',
      accessReason: 'extractor_empty_short_snippet_probable_paywall_domain',
      analysisBlocked: true,
      confidence: 'medium',
    };
  }

  if (normalizedExtracted.length >= PUBLIC_TEXT_MIN_CHARS) {
    return {
      accessStatus: 'PUBLIC',
      accessReason: 'full_text_available',
      analysisBlocked: false,
      confidence: 'none',
    };
  }

  return {
    accessStatus: 'UNKNOWN',
    accessReason: 'insufficient_signals',
    analysisBlocked: false,
    confidence: 'none',
  };
}

function hasSubscriberMetadataFlag(metadataFlags?: Record<string, unknown> | null): boolean {
  if (!metadataFlags || typeof metadataFlags !== 'object') {
    return false;
  }

  const targetKeys = new Set(['issubscribercontent', 'issuscribercontent']);

  const stack: unknown[] = [metadataFlags];
  let depth = 0;

  while (stack.length > 0 && depth < 64) {
    const current = stack.pop();
    depth += 1;

    if (!current || typeof current !== 'object') {
      continue;
    }

    if (Array.isArray(current)) {
      for (const item of current) {
        stack.push(item);
      }
      continue;
    }

    const entries = Object.entries(current as Record<string, unknown>);
    for (const [rawKey, value] of entries) {
      const key = normalizeKey(rawKey);
      if (targetKeys.has(key) && toTruthyBoolean(value)) {
        return true;
      }

      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return false;
}

function toTruthyBoolean(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = normalizeText(value);
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'si';
  }

  return false;
}

function findPaywallKeyword(normalizedText: string): string | null {
  if (!normalizedText) {
    return null;
  }

  for (const keyword of PAYWALL_KEYWORDS_ES) {
    if (normalizedText.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

function isProbablePaywallDomain(sourceDomain: string): boolean {
  if (!sourceDomain) {
    return false;
  }

  return PROBABLE_PAYWALL_DOMAINS.some((domain) =>
    sourceDomain === domain || sourceDomain.endsWith(`.${domain}`)
  );
}

function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) {
    return '';
  }

  return domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
}

function normalizeKey(key: string): string {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

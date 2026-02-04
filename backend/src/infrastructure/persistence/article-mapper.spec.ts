import { describe, it, expect } from 'vitest';
import { ArticleMapper } from './article-mapper';
import { NewsArticle } from '../../domain/entities/news-article.entity';
import type { Article as PrismaArticle } from '@prisma/client';

/**
 * ZONA ESTÁNDAR (CALIDAD.md): 80% coverage
 * Tests para mapeo bidireccional Prisma ↔ Domain
 * Incluye campos complejos de IA (analysis, internalReasoning)
 */

function createPrismaArticle(overrides: Partial<PrismaArticle> = {}): PrismaArticle {
  return {
    id: 'test-uuid-123',
    title: 'Artículo de prueba',
    description: 'Descripción de prueba',
    content: 'Contenido completo del artículo',
    url: 'https://example.com/article-1',
    urlToImage: 'https://example.com/image.jpg',
    source: 'TestSource',
    author: 'John Doe',
    publishedAt: new Date('2026-01-15T10:00:00Z'),
    category: 'tecnología',
    language: 'es',
    embedding: '[0.1, 0.2, 0.3]',
    summary: 'Resumen generado por IA',
    biasScore: 0.45,
    analysis: '{"summary":"Resumen","biasScore":0.45,"biasRaw":4.5,"biasIndicators":["ind1"],"clickbaitScore":20,"reliabilityScore":80,"sentiment":"neutral","mainTopics":["tech"],"factCheck":{"claims":["c1"],"verdict":"Verified","reasoning":"ok"}}',
    analyzedAt: new Date('2026-01-16T08:00:00Z'),
    internalReasoning: 'CoT: paso1→paso2→conclusión',
    isFavorite: false,
    fetchedAt: new Date('2026-01-15T12:00:00Z'),
    updatedAt: new Date('2026-01-16T08:00:00Z'),
    ...overrides,
  };
}

function createDomainArticle(overrides: Record<string, unknown> = {}): NewsArticle {
  return NewsArticle.create({
    id: 'test-uuid-456',
    title: 'Artículo de dominio',
    description: 'Descripción de dominio',
    content: 'Contenido de dominio',
    url: 'https://example.com/domain-article',
    urlToImage: null,
    source: 'DomainSource',
    author: null,
    publishedAt: new Date('2026-01-20T10:00:00Z'),
    category: 'política',
    language: 'en',
    embedding: null,
    summary: null,
    biasScore: null,
    analysis: null,
    analyzedAt: null,
    internalReasoning: null,
    isFavorite: false,
    fetchedAt: new Date('2026-01-20T12:00:00Z'),
    updatedAt: new Date('2026-01-20T12:00:00Z'),
    ...overrides,
  });
}

describe('ArticleMapper', () => {
  const mapper = new ArticleMapper();

  describe('toDomain', () => {
    it('mapea un PrismaArticle completo a NewsArticle', () => {
      const prisma = createPrismaArticle();
      const domain = mapper.toDomain(prisma);

      expect(domain.id).toBe(prisma.id);
      expect(domain.title).toBe(prisma.title);
      expect(domain.description).toBe(prisma.description);
      expect(domain.content).toBe(prisma.content);
      expect(domain.url).toBe(prisma.url);
      expect(domain.urlToImage).toBe(prisma.urlToImage);
      expect(domain.source).toBe(prisma.source);
      expect(domain.author).toBe(prisma.author);
      expect(domain.publishedAt).toEqual(prisma.publishedAt);
      expect(domain.category).toBe(prisma.category);
      expect(domain.language).toBe(prisma.language);
      expect(domain.embedding).toBe(prisma.embedding);
      expect(domain.summary).toBe(prisma.summary);
      expect(domain.biasScore).toBe(prisma.biasScore);
      expect(domain.analysis).toBe(prisma.analysis);
      expect(domain.analyzedAt).toEqual(prisma.analyzedAt);
      expect(domain.internalReasoning).toBe(prisma.internalReasoning);
      expect(domain.isFavorite).toBe(prisma.isFavorite);
      expect(domain.fetchedAt).toEqual(prisma.fetchedAt);
      expect(domain.updatedAt).toEqual(prisma.updatedAt);
    });

    it('maneja campos nullable con null', () => {
      const prisma = createPrismaArticle({
        description: null,
        content: null,
        urlToImage: null,
        author: null,
        category: null,
        embedding: null,
        summary: null,
        biasScore: null,
        analysis: null,
        analyzedAt: null,
        internalReasoning: null,
      });

      const domain = mapper.toDomain(prisma);

      expect(domain.description).toBeNull();
      expect(domain.content).toBeNull();
      expect(domain.urlToImage).toBeNull();
      expect(domain.author).toBeNull();
      expect(domain.category).toBeNull();
      expect(domain.embedding).toBeNull();
      expect(domain.summary).toBeNull();
      expect(domain.biasScore).toBeNull();
      expect(domain.analysis).toBeNull();
      expect(domain.analyzedAt).toBeNull();
      expect(domain.internalReasoning).toBeNull();
    });

    it('defaultea isFavorite a false cuando es null/undefined', () => {
      const prisma = createPrismaArticle();
      // Simular Prisma devolviendo null (edge case de migraciones)
      (prisma as any).isFavorite = null;

      const domain = mapper.toDomain(prisma);
      expect(domain.isFavorite).toBe(false);
    });

    it('preserva objetos Date (no los convierte a string)', () => {
      const prisma = createPrismaArticle();
      const domain = mapper.toDomain(prisma);

      expect(domain.publishedAt).toBeInstanceOf(Date);
      expect(domain.fetchedAt).toBeInstanceOf(Date);
      expect(domain.updatedAt).toBeInstanceOf(Date);
      expect(domain.analyzedAt).toBeInstanceOf(Date);
    });

    it('crea un NewsArticle válido (pasa validación de entidad)', () => {
      const prisma = createPrismaArticle();
      expect(() => mapper.toDomain(prisma)).not.toThrow();
    });

    it('preserva el campo internalReasoning para auditoría XAI', () => {
      const reasoning = 'CoT: evalué sesgo→verifiqué fuentes→determiné fiabilidad alta';
      const prisma = createPrismaArticle({ internalReasoning: reasoning });

      const domain = mapper.toDomain(prisma);
      expect(domain.internalReasoning).toBe(reasoning);
    });
  });

  describe('toUpsertData', () => {
    it('retorna where clause con url', () => {
      const article = createDomainArticle();
      const result = mapper.toUpsertData(article);

      expect(result.where).toEqual({ url: article.url });
    });

    it('incluye todos los campos update (sin campos inmutables)', () => {
      const article = createDomainArticle();
      const { update } = mapper.toUpsertData(article);

      // Campos que SÍ deben estar en update
      expect(update).toHaveProperty('title');
      expect(update).toHaveProperty('description');
      expect(update).toHaveProperty('content');
      expect(update).toHaveProperty('urlToImage');
      expect(update).toHaveProperty('author');
      expect(update).toHaveProperty('category');
      expect(update).toHaveProperty('embedding');
      expect(update).toHaveProperty('summary');
      expect(update).toHaveProperty('biasScore');
      expect(update).toHaveProperty('analysis');
      expect(update).toHaveProperty('analyzedAt');
      expect(update).toHaveProperty('internalReasoning');
      expect(update).toHaveProperty('isFavorite');
      expect(update).toHaveProperty('updatedAt');

      // Campos inmutables que NO deben estar en update
      expect(update).not.toHaveProperty('id');
      expect(update).not.toHaveProperty('url');
      expect(update).not.toHaveProperty('source');
      expect(update).not.toHaveProperty('publishedAt');
      expect(update).not.toHaveProperty('language');
      expect(update).not.toHaveProperty('fetchedAt');
    });

    it('incluye todos los campos en create', () => {
      const article = createDomainArticle();
      const { create } = mapper.toUpsertData(article);

      expect(create).toHaveProperty('id');
      expect(create).toHaveProperty('title');
      expect(create).toHaveProperty('description');
      expect(create).toHaveProperty('content');
      expect(create).toHaveProperty('url');
      expect(create).toHaveProperty('urlToImage');
      expect(create).toHaveProperty('source');
      expect(create).toHaveProperty('author');
      expect(create).toHaveProperty('publishedAt');
      expect(create).toHaveProperty('category');
      expect(create).toHaveProperty('language');
      expect(create).toHaveProperty('embedding');
      expect(create).toHaveProperty('summary');
      expect(create).toHaveProperty('biasScore');
      expect(create).toHaveProperty('analysis');
      expect(create).toHaveProperty('analyzedAt');
      expect(create).toHaveProperty('internalReasoning');
      expect(create).toHaveProperty('isFavorite');
      expect(create).toHaveProperty('fetchedAt');
      expect(create).toHaveProperty('updatedAt');
    });

    it('establece updatedAt como Date reciente en update y create', () => {
      const before = Date.now();
      const article = createDomainArticle();
      const { update, create } = mapper.toUpsertData(article);
      const after = Date.now();

      expect(update.updatedAt).toBeInstanceOf(Date);
      expect((update.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((update.updatedAt as Date).getTime()).toBeLessThanOrEqual(after);

      expect(create.updatedAt).toBeInstanceOf(Date);
      expect((create.updatedAt as Date).getTime()).toBeGreaterThanOrEqual(before);
      expect((create.updatedAt as Date).getTime()).toBeLessThanOrEqual(after);
    });

    it('maneja artículo sin análisis (campos IA null)', () => {
      const article = createDomainArticle({
        summary: null,
        biasScore: null,
        analysis: null,
        analyzedAt: null,
        internalReasoning: null,
      });

      const { update, create } = mapper.toUpsertData(article);

      expect(update.summary).toBeNull();
      expect(update.biasScore).toBeNull();
      expect(update.analysis).toBeNull();
      expect(update.analyzedAt).toBeNull();
      expect(update.internalReasoning).toBeNull();

      expect(create.summary).toBeNull();
      expect(create.biasScore).toBeNull();
      expect(create.analysis).toBeNull();
      expect(create.analyzedAt).toBeNull();
      expect(create.internalReasoning).toBeNull();
    });

    it('preserva internalReasoning para persistencia XAI', () => {
      const reasoning = 'CoT: análisis de sesgo completado';
      const analysisJson = '{"summary":"test","biasScore":0.5}';

      const article = createDomainArticle({
        summary: 'Resumen test',
        biasScore: 0.5,
        analysis: analysisJson,
        analyzedAt: new Date('2026-01-20T14:00:00Z'),
        internalReasoning: reasoning,
      });

      const { update, create } = mapper.toUpsertData(article);

      expect(update.internalReasoning).toBe(reasoning);
      expect(create.internalReasoning).toBe(reasoning);
    });

    it('preserva embedding data', () => {
      const embeddingVector = JSON.stringify(Array.from({ length: 768 }, (_, i) => i * 0.001));
      const article = createDomainArticle({ embedding: embeddingVector });

      const { update, create } = mapper.toUpsertData(article);

      expect(update.embedding).toBe(embeddingVector);
      expect(create.embedding).toBe(embeddingVector);
    });
  });

  describe('Roundtrip Consistency', () => {
    it('toDomain → toUpsertData.create preserva los campos del artículo original', () => {
      const prisma = createPrismaArticle();
      const domain = mapper.toDomain(prisma);
      const { create } = mapper.toUpsertData(domain);

      expect(create.id).toBe(prisma.id);
      expect(create.title).toBe(prisma.title);
      expect(create.description).toBe(prisma.description);
      expect(create.content).toBe(prisma.content);
      expect(create.url).toBe(prisma.url);
      expect(create.urlToImage).toBe(prisma.urlToImage);
      expect(create.source).toBe(prisma.source);
      expect(create.author).toBe(prisma.author);
      expect(create.publishedAt).toEqual(prisma.publishedAt);
      expect(create.category).toBe(prisma.category);
      expect(create.language).toBe(prisma.language);
      expect(create.embedding).toBe(prisma.embedding);
      expect(create.summary).toBe(prisma.summary);
      expect(create.biasScore).toBe(prisma.biasScore);
      expect(create.analysis).toBe(prisma.analysis);
      expect(create.analyzedAt).toEqual(prisma.analyzedAt);
      expect(create.internalReasoning).toBe(prisma.internalReasoning);
      expect(create.isFavorite).toBe(prisma.isFavorite);
      expect(create.fetchedAt).toEqual(prisma.fetchedAt);
      // updatedAt es new Date() en toUpsertData, no preserva el original
    });

    it('roundtrip con campos IA completos preserva integridad', () => {
      const fullAnalysis = JSON.stringify({
        internal_reasoning: 'CoT detallado',
        summary: 'Resumen completo',
        biasScore: 0.3,
        biasRaw: -3,
        biasIndicators: ['lenguaje cargado', 'selección de fuentes'],
        clickbaitScore: 15,
        reliabilityScore: 85,
        sentiment: 'neutral',
        mainTopics: ['economía', 'política'],
        factCheck: { claims: ['claim1'], verdict: 'Verified', reasoning: 'Fuentes verificadas' },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700, costEstimated: 0.0021 },
      });

      const prisma = createPrismaArticle({
        analysis: fullAnalysis,
        biasScore: 0.3,
        summary: 'Resumen completo',
        internalReasoning: 'CoT detallado',
      });

      const domain = mapper.toDomain(prisma);
      const { create } = mapper.toUpsertData(domain);

      expect(create.analysis).toBe(fullAnalysis);
      expect(create.biasScore).toBe(0.3);
      expect(create.summary).toBe('Resumen completo');
      expect(create.internalReasoning).toBe('CoT detallado');

      // Verificar que el JSON de analysis se puede parsear correctamente
      const parsed = domain.getParsedAnalysis();
      expect(parsed).not.toBeNull();
      expect(parsed!.biasScore).toBe(0.3);
      expect(parsed!.usage?.totalTokens).toBe(700);
    });
  });
});

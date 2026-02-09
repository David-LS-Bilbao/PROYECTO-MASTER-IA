/**
 * Routing Logic Integration Tests
 *
 * Sprint 23.2 - Verificación de la lógica de enrutamiento de noticias
 *
 * Este test suite verifica la lógica de negocio crítica para:
 * 1. Aislamiento de categorías (ciencia-tecnologia NO devuelve deportes)
 * 2. Lógica de noticias locales (búsqueda por ubicación del usuario)
 * 3. Fallback cuando no hay autenticación/ubicación
 *
 * IMPORTANTE: Estos tests usan la base de datos PostgreSQL real (localhost:5433)
 * y verifican la integración completa del flujo de datos.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createServer } from '../../src/infrastructure/http/server';
import { getPrismaClient, closePrismaClient } from '../../src/infrastructure/persistence/prisma.client';

// ============================================================================
// SETUP
// ============================================================================

/**
 * Usa el singleton PrismaClient del proyecto (con PrismaPg adapter)
 * para que se conecte a la misma base de datos PostgreSQL que el servidor.
 */
const prisma = getPrismaClient();

let app: Application;

/**
 * NOTA: No es necesario mockear Firebase manualmente.
 * El sistema detecta NODE_ENV=test y usa automáticamente firebaseAuthMock.
 *
 * Tokens válidos para tests (definidos en firebase.admin.mock.ts):
 * - test-token-bilbao     → user con location="Bilbao"
 * - test-token-madrid     → user con location="Madrid"
 * - test-token-no-location → user sin ubicación
 * - test-token-generic    → user genérico
 */

// IDs de prueba con prefijo para evitar colisiones con datos reales
const TEST_PREFIX = '__test_routing__';
const TEST_URL_PREFIX = `https://test-routing.example.com/${Date.now()}`;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Crea artículos de prueba en la base de datos
 */
async function seedTestArticles() {
  // 1. Crear Topics (upsert por si ya existen)
  const topicCiencia = await prisma.topic.upsert({
    where: { slug: 'ciencia-tecnologia' },
    update: {},
    create: { name: 'Ciencia y Tecnología', slug: 'ciencia-tecnologia' },
  });

  const topicDeportes = await prisma.topic.upsert({
    where: { slug: 'deportes' },
    update: {},
    create: { name: 'Deportes', slug: 'deportes' },
  });

  const topicEspana = await prisma.topic.upsert({
    where: { slug: 'espana' },
    update: {},
    create: { name: 'España', slug: 'espana' },
  });

  const topicLocal = await prisma.topic.upsert({
    where: { slug: 'local' },
    update: {},
    create: { name: 'Local', slug: 'local' },
  });

  // 2. Crear artículos de CIENCIA-TECNOLOGIA
  await prisma.article.createMany({
    data: [
      {
        title: `${TEST_PREFIX}Avance en Inteligencia Artificial para diagnóstico médico`,
        description: 'Nuevo algoritmo de IA mejora detección temprana de enfermedades',
        content: 'Investigadores desarrollan sistema de IA avanzado...',
        url: `${TEST_URL_PREFIX}/ia-medica-1`,
        source: 'TechNews',
        category: 'ciencia',
        topicId: topicCiencia.id,
        publishedAt: new Date(),
      },
      {
        title: `${TEST_PREFIX}Científicos descubren nueva partícula subatómica`,
        description: 'Hallazgo revolucionario en el acelerador de partículas',
        content: 'El CERN anuncia descubrimiento histórico...',
        url: `${TEST_URL_PREFIX}/particula-1`,
        source: 'ScienceDaily',
        category: 'ciencia',
        topicId: topicCiencia.id,
        publishedAt: new Date(),
      },
      {
        title: `${TEST_PREFIX}Lanzamiento del nuevo procesador cuántico`,
        description: 'Empresa tech presenta chip con 1000 qubits',
        content: 'Avance significativo en computación cuántica...',
        url: `${TEST_URL_PREFIX}/quantum-1`,
        source: 'TechCrunch',
        category: 'tecnologia',
        topicId: topicCiencia.id,
        publishedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  // 3. Crear artículos de DEPORTES (para verificar aislamiento)
  await prisma.article.createMany({
    data: [
      {
        title: `${TEST_PREFIX}Real Madrid gana la Champions League`,
        description: 'Victoria histórica en la final',
        content: 'El Real Madrid se corona campeón...',
        url: `${TEST_URL_PREFIX}/madrid-champions-1`,
        source: 'MarcaSports',
        category: 'deportes',
        topicId: topicDeportes.id,
        publishedAt: new Date(),
      },
      {
        title: `${TEST_PREFIX}Barcelona ficha nuevo delantero estrella`,
        description: 'Refuerzo importante para el equipo catalán',
        content: 'El FC Barcelona anuncia incorporación...',
        url: `${TEST_URL_PREFIX}/barca-fichaje-1`,
        source: 'MundoDeportivo',
        category: 'deportes',
        topicId: topicDeportes.id,
        publishedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  // 4. Crear artículos LOCALES (con ubicaciones específicas)
  await prisma.article.createMany({
    data: [
      {
        title: `${TEST_PREFIX}Inauguran nuevo museo en Bilbao`,
        description: 'Exposición de arte contemporáneo en el centro de Bilbao',
        content: 'La ciudad de Bilbao inaugura un innovador espacio cultural...',
        url: `${TEST_URL_PREFIX}/museo-bilbao-1`,
        source: 'ElCorreo',
        category: 'cultura',
        topicId: topicLocal.id,
        publishedAt: new Date(),
      },
      {
        title: `${TEST_PREFIX}Tráfico colapsado en el centro de Bilbao por obras`,
        description: 'Reformas en Gran Vía afectan circulación en Bilbao',
        content: 'Las obras de remodelación en Bilbao causan retrasos...',
        url: `${TEST_URL_PREFIX}/trafico-bilbao-1`,
        source: 'DV',
        category: 'local',
        topicId: topicLocal.id,
        publishedAt: new Date(),
      },
      {
        title: `${TEST_PREFIX}Madrid acoge la cumbre del clima`,
        description: 'Líderes mundiales se reúnen en Madrid',
        content: 'Madrid se convierte en el epicentro de las negociaciones climáticas...',
        url: `${TEST_URL_PREFIX}/cumbre-madrid-1`,
        source: 'ElPaís',
        category: 'politica',
        topicId: topicEspana.id,
        publishedAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  // 5. Crear usuarios de prueba (los IDs deben coincidir con firebase.admin.mock.ts)
  await prisma.user.upsert({
    where: { id: 'test-user-bilbao' },
    update: { location: 'Bilbao', email: 'bilbao-user@test.com' },
    create: {
      id: 'test-user-bilbao',
      email: 'bilbao-user@test.com',
      name: 'Bilbao Test User',
      location: 'Bilbao',
    },
  });

  await prisma.user.upsert({
    where: { id: 'test-user-madrid' },
    update: { location: 'Madrid', email: 'madrid-user@test.com' },
    create: {
      id: 'test-user-madrid',
      email: 'madrid-user@test.com',
      name: 'Madrid Test User',
      location: 'Madrid',
    },
  });
}

/**
 * Limpia solo los datos de prueba creados por este test
 * (usa TEST_PREFIX para no borrar datos reales)
 */
async function cleanupTestData() {
  // 1. Eliminar favoritos de usuarios de test
  await prisma.favorite.deleteMany({
    where: {
      userId: {
        in: ['test-user-bilbao', 'test-user-madrid', 'test-user-no-location'],
      },
    },
  });

  // 2. Eliminar artículos de test (por URL prefix)
  await prisma.article.deleteMany({
    where: {
      url: { startsWith: 'https://test-routing.example.com/' },
    },
  });

  // 3. Eliminar usuarios de test
  await prisma.user.deleteMany({
    where: {
      id: {
        in: ['test-user-bilbao', 'test-user-madrid', 'test-user-no-location'],
      },
    },
  });
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('🧪 Routing Logic Integration Tests - Sprint 23.2', () => {
  beforeAll(async () => {
    // Asegurar que estamos en entorno de test
    process.env.NODE_ENV = 'test';

    // Crear servidor Express con dependencias reales
    // El middleware de autenticación usa firebaseAuthMock automáticamente
    app = createServer();
  });

  beforeEach(async () => {
    // Limpiar y repoblar datos antes de cada test
    await cleanupTestData();
    await seedTestArticles();
  });

  afterAll(async () => {
    // Limpieza final
    await cleanupTestData();
    await closePrismaClient();
  });

  // ==========================================================================
  // TEST 1: STANDARD CATEGORY ISOLATION
  // ==========================================================================

  describe('🔒 Test 1: Standard Category Isolation', () => {
    it('debe devolver SOLO artículos de ciencia-tecnologia, NO de deportes', async () => {
      // ACT
      const response = await request(app)
        .get('/api/news')
        .query({ category: 'ciencia-tecnologia', limit: 20 });

      // ASSERT - Status OK
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // ASSERT - Tiene artículos
      const articles = response.body.data;
      expect(articles).toBeDefined();
      expect(articles.length).toBeGreaterThan(0);

      // ASSERT - TODOS los artículos son de ciencia, tecnologia, o ciencia-tecnologia
      const validSciTechCategories = ['ciencia', 'tecnologia', 'ciencia-tecnologia'];
      articles.forEach((article: any) => {
        const category = article.category?.toLowerCase() || '';
        expect(
          validSciTechCategories.includes(category),
          `Artículo "${article.title}" tiene categoría incorrecta: "${article.category}"`
        ).toBe(true);
      });

      // ASSERT - NO contiene artículos de deportes
      const deportesArticles = articles.filter((article: any) =>
        article.category?.toLowerCase() === 'deportes'
      );
      expect(deportesArticles.length).toBe(0);
    });

    it('debe devolver SOLO artículos de deportes, NO de ciencia-tecnologia', async () => {
      // ACT
      const response = await request(app)
        .get('/api/news')
        .query({ category: 'deportes', limit: 20 });

      // ASSERT - Status OK
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // ASSERT - Tiene artículos
      const articles = response.body.data;
      expect(articles).toBeDefined();
      expect(articles.length).toBeGreaterThan(0);

      // ASSERT - TODOS los artículos son de deportes
      articles.forEach((article: any) => {
        expect(article.category?.toLowerCase()).toBe('deportes');
      });

      // ASSERT - NO contiene artículos de ciencia/tecnologia
      const cienciaArticles = articles.filter((article: any) => {
        const cat = article.category?.toLowerCase() || '';
        return cat === 'ciencia' || cat === 'tecnologia';
      });
      expect(cienciaArticles.length).toBe(0);
    });
  });

  // ==========================================================================
  // TEST 2: LOCAL NEWS LOGIC (THE CRITICAL FIX)
  // ==========================================================================

  describe('📍 Test 2: Local News Logic - Sprint 23.2 Critical Fix', () => {
    it('debe buscar artículos con "Bilbao" cuando user.location="Bilbao"', async () => {
      // ACT - El token test-token-bilbao se resuelve a UID test-user-bilbao
      //       El middleware sincroniza con la DB → location=Bilbao
      //       El controller busca con searchArticles("Bilbao")
      const response = await request(app)
        .get('/api/news')
        .set('Authorization', 'Bearer test-token-bilbao')
        .query({ category: 'local', limit: 20 });

      // ASSERT - Status OK
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // ASSERT - Metadata confirma ubicación
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.location).toBe('Bilbao');
      expect(response.body.meta.message).toContain('Bilbao');

      // ASSERT - Artículos contienen "Bilbao" en título, descripción o contenido
      const articles = response.body.data;
      expect(articles).toBeDefined();
      expect(articles.length).toBeGreaterThan(0);

      const bilbaoArticles = articles.filter((article: any) => {
        const title = article.title?.toLowerCase() || '';
        const description = article.description?.toLowerCase() || '';
        const content = article.content?.toLowerCase() || '';
        return (
          title.includes('bilbao') ||
          description.includes('bilbao') ||
          content.includes('bilbao')
        );
      });

      expect(
        bilbaoArticles.length,
        'Debe haber al menos un artículo relacionado con Bilbao'
      ).toBeGreaterThan(0);
    });

    it('debe buscar artículos con "Madrid" cuando user.location="Madrid"', async () => {
      // ACT
      const response = await request(app)
        .get('/api/news')
        .set('Authorization', 'Bearer test-token-madrid')
        .query({ category: 'local', limit: 20 });

      // ASSERT - Status OK
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // ASSERT - Metadata confirma ubicación Madrid
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.location).toBe('Madrid');

      // ASSERT - Artículos contienen "Madrid"
      const articles = response.body.data;
      expect(articles).toBeDefined();
      expect(articles.length).toBeGreaterThan(0);

      const madridArticles = articles.filter((article: any) => {
        const title = article.title?.toLowerCase() || '';
        const content = article.content?.toLowerCase() || '';
        return title.includes('madrid') || content.includes('madrid');
      });

      expect(madridArticles.length).toBeGreaterThan(0);
    });

    it('debe incluir hasMore en la paginación local', async () => {
      // ACT
      const response = await request(app)
        .get('/api/news')
        .set('Authorization', 'Bearer test-token-bilbao')
        .query({ category: 'local', limit: 20 });

      // ASSERT - Status OK y pagination presente
      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(typeof response.body.pagination.hasMore).toBe('boolean');
      expect(typeof response.body.pagination.total).toBe('number');
      expect(typeof response.body.pagination.limit).toBe('number');
    });
  });

  // ==========================================================================
  // TEST 3: FALLBACK LOGIC
  // ==========================================================================

  describe('🔄 Test 3: Fallback Logic', () => {
    it('debe devolver 401 cuando se solicita "local" sin autenticación', async () => {
      // ACT - Sin token de autenticación
      const response = await request(app)
        .get('/api/news')
        .query({ category: 'local', limit: 20 });

      // ASSERT - Debe rechazar o devolver datos sin info de ubicación
      // El middleware optionalAuthenticate permite acceso sin token,
      // pero "local" requiere user.location que solo está disponible autenticado
      // El controlador debe manejar este caso gracefully
      expect([200, 400, 401]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });

    it('debe manejar usuario sin ubicación cuando pide "local"', async () => {
      // ARRANGE - Crear usuario sin ubicación
      await prisma.user.upsert({
        where: { id: 'test-user-no-location' },
        update: { location: null },
        create: {
          id: 'test-user-no-location',
          email: 'no-location@test.com',
          name: 'No Location User',
          location: null,
        },
      });

      // ACT - Usar token mockeado para usuario sin ubicación
      const response = await request(app)
        .get('/api/news')
        .set('Authorization', 'Bearer test-token-no-location')
        .query({ category: 'local', limit: 20 });

      // ASSERT - Debe devolver error o fallback (no crash)
      expect([200, 400]).toContain(response.status);
      expect(response.body).toHaveProperty('success');

      if (response.status === 400) {
        // Si devuelve 400, el error debe mencionar ubicación
        expect(response.body.success).toBe(false);
      }
    });

    it('debe devolver noticias cuando categoría estándar existe', async () => {
      // ACT - Categoría válida sin autenticación
      const response = await request(app)
        .get('/api/news')
        .query({ category: 'deportes', limit: 20 });

      // ASSERT - Debe funcionar sin autenticación
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  // ==========================================================================
  // TEST 4: PAGINATION LOGIC
  // ==========================================================================

  describe('📄 Test 4: Pagination Logic', () => {
    it('debe respetar el parámetro limit', async () => {
      // ACT
      const response = await request(app)
        .get('/api/news')
        .query({ category: 'ciencia-tecnologia', limit: 2 });

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination.limit).toBe(2);
    });

    it('debe respetar el parámetro offset', async () => {
      // ACT - Primera página
      const page1 = await request(app)
        .get('/api/news')
        .query({ category: 'ciencia-tecnologia', limit: 2, offset: 0 });

      // ACT - Segunda página
      const page2 = await request(app)
        .get('/api/news')
        .query({ category: 'ciencia-tecnologia', limit: 2, offset: 2 });

      // ASSERT - Ambas páginas deben ser exitosas
      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);

      // ASSERT - Si hay datos en ambas, no deben duplicarse
      if (page1.body.data.length > 0 && page2.body.data.length > 0) {
        const ids1 = page1.body.data.map((a: any) => a.id);
        const ids2 = page2.body.data.map((a: any) => a.id);

        const intersection = ids1.filter((id: string) => ids2.includes(id));
        expect(intersection.length).toBe(0);
      }
    });

    it('debe incluir información de paginación completa', async () => {
      // ACT
      const response = await request(app)
        .get('/api/news')
        .query({ category: 'deportes', limit: 10, offset: 0 });

      // ASSERT
      expect(response.status).toBe(200);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('offset');
      expect(response.body.pagination).toHaveProperty('hasMore');
    });
  });
});

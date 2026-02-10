/**
 * Auth Middleware Security Tests - BLOQUEANTE #3
 *
 * OBJETIVO: Validar que el middleware rechaza/sanea payloads maliciosos
 * en los campos preferences y usageStats (actualmente tipados como `any`)
 *
 * VULNERABILIDAD:
 * - XSS injection en preferences
 * - SQL injection en usageStats
 * - Malformed JSON structures
 * - Type confusion attacks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// ============================================================================
// MOCKS (hoisted to prevent ReferenceError)
// ============================================================================

// Mock functions must be defined before vi.mock calls
const { mockVerifyIdToken, mockUserUpsert } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockUserUpsert: vi.fn(),
}));

// Mock de Firebase Admin SDK
vi.mock('../../../../src/infrastructure/external/firebase.admin', () => ({
  firebaseAuth: {
    verifyIdToken: mockVerifyIdToken,
  },
}));

// Mock de Prisma Client
vi.mock('../../../../src/infrastructure/persistence/prisma.client', () => ({
  getPrismaClient: () => ({
    user: {
      upsert: mockUserUpsert,
    },
  }),
}));

// Import after mocks are defined
import { authenticate, optionalAuthenticate, requirePlan } from '../../../../src/infrastructure/http/middleware/auth.middleware';

// ============================================================================
// TEST SUITE
// ============================================================================

describe('🔐 Auth Middleware - Security & Type Safety (BLOQUEANTE #3)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock request
    mockReq = {
      headers: {
        authorization: 'Bearer test-token-12345',
      },
    };

    // Mock response
    const jsonMock = vi.fn();
    const statusMock = vi.fn(() => ({ json: jsonMock }));
    mockRes = {
      status: statusMock as any,
      json: jsonMock,
    };

    // Mock next
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // BLOQUEANTE #3: VULNERABILITY TESTS (debe FALLAR hasta implementar Zod)
  // ==========================================================================

  describe('🚨 RED PHASE: Type Safety Vulnerabilities', () => {
    it('BLOQUEANTE #3: Should reject malformed or malicious user preferences', async () => {
      // ARRANGE - Simular token de Firebase con payload malicioso
      const maliciousToken = {
        uid: 'test-user-123',
        email: 'attacker@example.com',
        name: 'Test Attacker',
        picture: null,
      };

      mockVerifyIdToken.mockResolvedValueOnce(maliciousToken);

      // Simular que Prisma devuelve un usuario con preferences maliciosas
      const maliciousUser = {
        id: 'test-user-123',
        email: 'attacker@example.com',
        name: 'Test Attacker',
        picture: null,
        subscriptionPlan: 'FREE',
        // ❌ PAYLOAD MALICIOSO: XSS, SQL Injection, Type Confusion
        preferences: {
          '<script>alert(1)</script>': 'xss-attack',
          "theme": "'; DROP TABLE users; --",
          "categories": "not-an-array", // Debería ser array
          "maliciousObject": { "nested": { "deep": { "attack": true } } },
        },
        usageStats: {
          "apiCalls": "NaN", // Debería ser número
          "cost": "Infinity", // Debería ser número
          "injection": "1' OR '1'='1",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserUpsert.mockResolvedValueOnce(maliciousUser);

      // ACT
      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      // ASSERT - Actualmente el middleware acepta el payload malicioso
      // Este test DEBE FALLAR porque no hay validación

      // Verificar que el usuario fue inyectado en req.user
      expect(mockReq.user).toBeDefined();

      // ❌ VULNERABILIDAD: preferences contiene payload malicioso
      // Después de implementar Zod, esto debe ser saneado o rechazado
      const userPreferences = mockReq.user?.preferences;

      // Test que DEBE FALLAR en RED phase:
      // Esperamos que preferences NO contenga scripts maliciosos
      expect(JSON.stringify(userPreferences)).not.toContain('<script>');
      expect(JSON.stringify(userPreferences)).not.toContain('DROP TABLE');

      // Esperamos que categories sea un array válido
      if (userPreferences && 'categories' in userPreferences) {
        expect(Array.isArray(userPreferences.categories)).toBe(true);
      }

      // Esperamos que usageStats tenga tipos correctos
      const usageStats = mockReq.user?.usageStats;
      if (usageStats && 'apiCalls' in usageStats) {
        expect(typeof usageStats.apiCalls).toBe('number');
      }
      if (usageStats && 'cost' in usageStats) {
        expect(typeof usageStats.cost).toBe('number');
      }
    });

    it('BLOQUEANTE #3: Should sanitize to safe defaults when preferences are corrupted', async () => {
      // ARRANGE
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'test-user-456',
        email: 'user@example.com',
        name: 'Test User',
      });

      // Usuario con preferences completamente corruptas
      mockUserUpsert.mockResolvedValueOnce({
        id: 'test-user-456',
        email: 'user@example.com',
        name: 'Test User',
        picture: null,
        subscriptionPlan: 'FREE',
        preferences: "not-an-object", // ❌ Debería ser objeto
        usageStats: null, // ❌ Debería ser objeto
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ACT
      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      // ASSERT - Después de Zod, debe haber defaults seguros
      expect(mockReq.user).toBeDefined();

      // Esperamos que preferences sea un objeto válido (no string)
      expect(typeof mockReq.user?.preferences).toBe('object');
      expect(mockReq.user?.preferences).not.toBe(null);

      // Esperamos que usageStats sea un objeto válido (no null)
      expect(typeof mockReq.user?.usageStats).toBe('object');
      expect(mockReq.user?.usageStats).not.toBe(null);
    });
  });

  // ==========================================================================
  // HAPPY PATH: Login normal debe seguir funcionando
  // ==========================================================================

  describe('✅ Happy Path: Normal Authentication', () => {
    it('Should authenticate user with valid token and clean preferences', async () => {
      // ARRANGE - Token válido con preferences limpias
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'valid-user-789',
        email: 'valid@example.com',
        name: 'Valid User',
        picture: 'https://example.com/avatar.jpg',
      });

      mockUserUpsert.mockResolvedValueOnce({
        id: 'valid-user-789',
        email: 'valid@example.com',
        name: 'Valid User',
        picture: 'https://example.com/avatar.jpg',
        subscriptionPlan: 'PREMIUM',
        preferences: {
          theme: 'dark',
          categories: ['technology', 'science'],
        },
        usageStats: {
          apiCalls: 150,
          tokensUsed: 50000,
          cost: 0.05,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ACT
      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      // ASSERT
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.email).toBe('valid@example.com');
      expect(mockReq.user?.subscriptionPlan).toBe('PREMIUM');

      // Preferences válidas pasan validación Zod (con defaults opcionales)
      expect(mockReq.user?.preferences).toMatchObject({
        theme: 'dark',
        categories: ['technology', 'science'],
      });
      // Verificar que los campos opcionales tienen defaults seguros
      expect(mockReq.user?.preferences.compactMode).toBe(false);
      expect(mockReq.user?.preferences.notificationsEnabled).toBe(true);
      expect(mockReq.user?.preferences.language).toBe('es');
    });

    it('Should reject request without authorization header', async () => {
      // ARRANGE
      mockReq.headers = {}; // Sin header Authorization

      // ACT
      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      // ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('Should reject request with empty token', async () => {
      mockReq.headers = { authorization: 'Bearer ' };

      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('Should reject when Firebase verification fails', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('Should reject when token lacks uid/email', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ uid: 'u1', email: null });

      await authenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('🔓 Optional Auth Middleware', () => {
    it('Should continue without header', async () => {
      mockReq.headers = {};
      await optionalAuthenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('Should continue when token is invalid', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

      await optionalAuthenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('Should attach user when token is valid', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        uid: 'opt-user',
        email: 'opt@example.com',
        name: 'Opt User',
        picture: null,
      });

      mockUserUpsert.mockResolvedValueOnce({
        id: 'opt-user',
        email: 'opt@example.com',
        name: 'Opt User',
        picture: null,
        subscriptionPlan: 'FREE',
        preferences: {},
        usageStats: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await optionalAuthenticate(
        mockReq as Request,
        mockRes as Response,
        mockNext as NextFunction
      );

      expect(mockReq.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('💎 requirePlan middleware', () => {
    it('Should reject when user missing', () => {
      const middleware = requirePlan(['PREMIUM']);
      const req = {} as Request;
      const res = mockRes as Response;
      const next = mockNext as NextFunction;

      middleware(req, res, next);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('Should reject when plan is insufficient', () => {
      const middleware = requirePlan(['PREMIUM']);
      const req = { user: { subscriptionPlan: 'FREE' } } as Request;
      const res = mockRes as Response;
      const next = mockNext as NextFunction;

      middleware(req, res, next);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('Should allow when plan is allowed', () => {
      const middleware = requirePlan(['PREMIUM', 'FREE']);
      const req = { user: { subscriptionPlan: 'FREE' } } as Request;
      const res = mockRes as Response;
      const next = mockNext as NextFunction;

      middleware(req, res, next);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

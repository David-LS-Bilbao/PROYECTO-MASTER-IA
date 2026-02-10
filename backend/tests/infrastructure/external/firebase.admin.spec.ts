/**
 * Firebase Admin Helpers Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearMockData } from '../../../src/infrastructure/external/firebase.admin.mock';

// ============================================================================
// TESTS
// ============================================================================

describe('firebase.admin helpers', () => {
  let verifyAuthToken: any;
  let getUserByUid: any;
  let getUserByEmail: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    clearMockData();
    process.env.NODE_ENV = 'test';
    process.env.VITEST = 'true';
    vi.resetModules();

    const mod = await import('../../../src/infrastructure/external/firebase.admin');
    verifyAuthToken = mod.verifyAuthToken;
    getUserByUid = mod.getUserByUid;
    getUserByEmail = mod.getUserByEmail;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifyAuthToken retorna token decodificado', async () => {
    const decoded = await verifyAuthToken('test-token-bilbao');

    expect(decoded.uid).toBe('test-user-bilbao');
    expect(decoded.email).toBe('bilbao-user@test.com');
  });

  it('verifyAuthToken lanza error si token invalido', async () => {
    await expect(verifyAuthToken('invalid-token')).rejects.toThrow(
      'Token de autenticación inválido o expirado'
    );
  });

  it('getUserByUid retorna usuario', async () => {
    const user = await getUserByUid('test-user-madrid');

    expect(user.uid).toBe('test-user-madrid');
    expect(user.email).toBe('madrid-user@test.com');
  });

  it('getUserByUid lanza error si no existe', async () => {
    await expect(getUserByUid('no-exists')).rejects.toThrow('Usuario no encontrado: no-exists');
  });

  it('getUserByEmail retorna usuario', async () => {
    const user = await getUserByEmail('test@example.com');

    expect(user.uid).toBe('test-user-generic');
  });

  it('getUserByEmail lanza error si no existe', async () => {
    await expect(getUserByEmail('nope@test.com')).rejects.toThrow('Usuario no encontrado: nope@test.com');
  });
});

describe('firebase.admin initialization (non-test env)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VITEST;
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('firebase-admin');
    vi.unmock('fs');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unmock('firebase-admin');
    vi.unmock('fs');
  });

  it('reutiliza app existente sin inicializar de nuevo', async () => {
    const mockVerifyIdToken = vi.fn().mockResolvedValue({ uid: 'u1' });
    const mockApp = {
      auth: () => ({
        verifyIdToken: mockVerifyIdToken,
        getUser: vi.fn(),
        getUserByEmail: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
      }),
    };

    const adminMock = {
      apps: [mockApp],
      initializeApp: vi.fn(),
      credential: { cert: vi.fn() },
    };

    vi.doMock('firebase-admin', () => adminMock);

    const mod = await import('../../../src/infrastructure/external/firebase.admin');
    await mod.firebaseAuth.verifyIdToken('token-1');

    expect(adminMock.initializeApp).not.toHaveBeenCalled();
    expect(mockVerifyIdToken).toHaveBeenCalledWith('token-1');
  });

  it('inicializa con variables de entorno cuando existen', async () => {
    process.env.FIREBASE_PROJECT_ID = 'env-project';
    process.env.FIREBASE_PRIVATE_KEY = 'line1\\nline2';
    process.env.FIREBASE_CLIENT_EMAIL = 'env@test.com';

    const mockVerifyIdToken = vi.fn().mockResolvedValue({ uid: 'u2' });
    const mockApp = {
      auth: () => ({
        verifyIdToken: mockVerifyIdToken,
        getUser: vi.fn(),
        getUserByEmail: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
      }),
    };

    const adminMock = {
      apps: [],
      initializeApp: vi.fn(() => {
        adminMock.apps.push(mockApp as any);
        return mockApp as any;
      }),
      credential: { cert: vi.fn(() => ({ mocked: true })) },
    };

    vi.doMock('firebase-admin', () => adminMock);

    const mod = await import('../../../src/infrastructure/external/firebase.admin');
    await mod.firebaseAuth.verifyIdToken('token-2');

    expect(adminMock.credential.cert).toHaveBeenCalledWith({
      projectId: 'env-project',
      privateKey: 'line1\nline2',
      clientEmail: 'env@test.com',
    });
    expect(adminMock.initializeApp).toHaveBeenCalledWith({
      credential: { mocked: true },
      projectId: 'env-project',
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('token-2');
  });

  it('inicializa con service-account.json cuando no hay env vars', async () => {
    const mockVerifyIdToken = vi.fn().mockResolvedValue({ uid: 'u3' });
    const mockApp = {
      auth: () => ({
        verifyIdToken: mockVerifyIdToken,
        getUser: vi.fn(),
        getUserByEmail: vi.fn(),
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
      }),
    };

    const adminMock = {
      apps: [],
      initializeApp: vi.fn(() => {
        adminMock.apps.push(mockApp as any);
        return mockApp as any;
      }),
      credential: { cert: vi.fn(() => ({ mocked: true })) },
    };

    vi.doMock('firebase-admin', () => adminMock);
    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => JSON.stringify({
        project_id: 'local-project',
        private_key: 'local-key',
        client_email: 'local@test.com',
      })),
    }));

    const mod = await import('../../../src/infrastructure/external/firebase.admin');
    await mod.firebaseAuth.verifyIdToken('token-3');

    expect(adminMock.credential.cert).toHaveBeenCalledWith({
      project_id: 'local-project',
      private_key: 'local-key',
      client_email: 'local@test.com',
    });
    expect(adminMock.initializeApp).toHaveBeenCalledWith({
      credential: { mocked: true },
      projectId: 'local-project',
    });
    expect(mockVerifyIdToken).toHaveBeenCalledWith('token-3');
  });

  it('lanza error si no hay credenciales ni archivo local', async () => {
    const adminMock = {
      apps: [],
      initializeApp: vi.fn(),
      credential: { cert: vi.fn() },
    };

    vi.doMock('firebase-admin', () => adminMock);
    vi.doMock('fs', () => ({
      existsSync: vi.fn(() => false),
      readFileSync: vi.fn(),
    }));

    const mod = await import('../../../src/infrastructure/external/firebase.admin');

    await expect(mod.firebaseAuth.getUser('missing')).rejects.toThrow(
      'Firebase Admin: No se encontraron credenciales.'
    );
  });
});

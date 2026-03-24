import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const initializeAppMock = vi.fn((config) => ({ name: 'mock-app', options: config }));
const getAppsMock = vi.fn(() => []);
const getAuthMock = vi.fn(() => ({ currentUser: null }));
const setPersistenceMock = vi.fn(() => Promise.resolve());

vi.mock('firebase/app', () => ({
  initializeApp: (...args: unknown[]) => initializeAppMock(...args),
  getApps: () => getAppsMock(),
}));

vi.mock('firebase/auth', () => ({
  getAuth: (...args: unknown[]) => getAuthMock(...args),
  setPersistence: (...args: unknown[]) => setPersistenceMock(...args),
  browserLocalPersistence: { type: 'LOCAL' },
}));

describe('frontend firebase config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    delete process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    delete process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    delete process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    delete process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('usa fallback local en desarrollo cuando faltan variables públicas', async () => {
    process.env.NODE_ENV = 'development';

    const mod = await import('@/lib/firebase');

    expect(mod.isFirebaseConfigured).toBe(true);
    expect(mod.getFirebaseConfigErrorMessage()).toBe('');
    expect(initializeAppMock).toHaveBeenCalledWith({
      apiKey: 'AIzaSyAXMyAj_pScRoICzSqiz2AOj-73OE835zQ',
      authDomain: 'verity-news-4a798.firebaseapp.com',
      projectId: 'verity-news-4a798',
      storageBucket: 'verity-news-4a798.firebasestorage.app',
      messagingSenderId: '539828085308',
      appId: '1:539828085308:web:f464fb3e2810a982d65939',
    });
  });

  it('muestra los nombres reales de variables cuando faltan en producción', async () => {
    process.env.NODE_ENV = 'production';

    const mod = await import('@/lib/firebase');

    expect(mod.isFirebaseConfigured).toBe(false);
    expect(mod.getFirebaseConfigErrorMessage()).toBe(
      'Falta la configuración pública de Firebase: ' +
        [
          'NEXT_PUBLIC_FIREBASE_API_KEY',
          'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
          'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
          'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
          'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
          'NEXT_PUBLIC_FIREBASE_APP_ID',
        ].join(', ')
    );
    expect(initializeAppMock).not.toHaveBeenCalled();
  });
});

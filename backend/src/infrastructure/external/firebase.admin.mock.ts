/**
 * Firebase Admin SDK - Mock para Tests
 *
 * Proporciona un mock de Firebase Auth para tests de integración.
 * Permite simular autenticación sin necesidad de credenciales reales.
 *
 * IMPORTANTE: Solo se usa cuando NODE_ENV=test
 *
 * @module infrastructure/external/firebase.admin.mock
 */

import * as admin from 'firebase-admin';

/**
 * Base de datos en memoria de usuarios mockeados
 */
const MOCK_USERS: Record<string, {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  location?: string;
}> = {
  // Usuario de prueba con ubicación Bilbao
  'test-user-bilbao': {
    uid: 'test-user-bilbao',
    email: 'bilbao-user@test.com',
    displayName: 'Bilbao Test User',
    location: 'Bilbao',
  },
  // Usuario de prueba con ubicación Madrid
  'test-user-madrid': {
    uid: 'test-user-madrid',
    email: 'madrid-user@test.com',
    displayName: 'Madrid Test User',
    location: 'Madrid',
  },
  // Usuario sin ubicación
  'test-user-no-location': {
    uid: 'test-user-no-location',
    email: 'no-location@test.com',
    displayName: 'No Location User',
  },
  // Usuario genérico de test
  'test-user-generic': {
    uid: 'test-user-generic',
    email: 'test@example.com',
    displayName: 'Test User',
  },
};

/**
 * Mapeo de tokens mockeados a UIDs de usuarios
 *
 * Los tests deben usar estos tokens en el header Authorization:
 * - Authorization: Bearer test-token-bilbao
 * - Authorization: Bearer test-token-madrid
 * - etc.
 */
const TOKEN_TO_UID: Record<string, string> = {
  'test-token-bilbao': 'test-user-bilbao',
  'test-token-madrid': 'test-user-madrid',
  'test-token-no-location': 'test-user-no-location',
  'test-token-generic': 'test-user-generic',

  // Aliases para compatibilidad con tests existentes
  'valid-token-bilbao': 'test-user-bilbao',
  'valid-token-madrid': 'test-user-madrid',
  'valid-token-no-location': 'test-user-no-location',
};

/**
 * Mock de Firebase Auth.verifyIdToken()
 *
 * Acepta tokens mockeados y devuelve DecodedIdToken simulado.
 *
 * @param token - Token de prueba (ej: "test-token-bilbao")
 * @returns DecodedIdToken con datos del usuario mockeado
 * @throws Error si el token no es válido
 */
async function mockVerifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
  console.log(`🧪 [MOCK] Verificando token de test: ${token.substring(0, 20)}...`);

  // Buscar UID correspondiente al token
  const uid = TOKEN_TO_UID[token];

  if (!uid) {
    console.log(`🧪 [MOCK] Token inválido: ${token}`);
    throw new Error('Invalid token - not found in mock database');
  }

  // Buscar usuario mockeado
  const user = MOCK_USERS[uid];

  if (!user) {
    console.log(`🧪 [MOCK] Usuario no encontrado para UID: ${uid}`);
    throw new Error(`User not found for UID: ${uid}`);
  }

  console.log(`🧪 [MOCK] Token verificado → Usuario: ${user.email} (${uid})`);

  // Crear DecodedIdToken simulado
  const decodedToken: admin.auth.DecodedIdToken = {
    uid: user.uid,
    email: user.email,
    name: user.displayName,
    picture: user.photoURL,
    // Campos requeridos por DecodedIdToken
    aud: 'mock-project',
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // Expira en 1 hora
    iat: Math.floor(Date.now() / 1000),
    iss: 'https://securetoken.google.com/mock-project',
    sub: user.uid,
    firebase: {
      identities: {
        email: [user.email],
      },
      sign_in_provider: 'password',
    },
  };

  return decodedToken;
}

/**
 * Mock de Firebase Auth.getUser()
 */
async function mockGetUser(uid: string): Promise<admin.auth.UserRecord> {
  const user = MOCK_USERS[uid];

  if (!user) {
    throw new Error(`User not found: ${uid}`);
  }

  // Crear UserRecord simulado (solo campos relevantes)
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: true,
    displayName: user.displayName,
    photoURL: user.photoURL,
    disabled: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
      lastRefreshTime: null,
      toJSON: () => ({}),
    },
    providerData: [],
    toJSON: () => ({}),
  } as admin.auth.UserRecord;
}

/**
 * Mock de Firebase Auth.getUserByEmail()
 */
async function mockGetUserByEmail(email: string): Promise<admin.auth.UserRecord> {
  const user = Object.values(MOCK_USERS).find(u => u.email === email);

  if (!user) {
    throw new Error(`User not found with email: ${email}`);
  }

  return mockGetUser(user.uid);
}

/**
 * Mock de Firebase Auth.createUser() - No implementado para tests
 */
async function mockCreateUser(_properties: admin.auth.CreateRequest): Promise<admin.auth.UserRecord> {
  throw new Error('Mock createUser not implemented - not needed for integration tests');
}

/**
 * Mock de Firebase Auth.updateUser() - No implementado para tests
 */
async function mockUpdateUser(_uid: string, _properties: admin.auth.UpdateRequest): Promise<admin.auth.UserRecord> {
  throw new Error('Mock updateUser not implemented - not needed for integration tests');
}

/**
 * Mock de Firebase Auth.deleteUser() - No implementado para tests
 */
async function mockDeleteUser(_uid: string): Promise<void> {
  throw new Error('Mock deleteUser not implemented - not needed for integration tests');
}

/**
 * Exportar objeto firebaseAuth mockeado
 *
 * Tiene la misma interfaz que el real, pero usa funciones mockeadas.
 */
export const firebaseAuthMock = {
  verifyIdToken: mockVerifyIdToken,
  getUser: mockGetUser,
  getUserByEmail: mockGetUserByEmail,
  createUser: mockCreateUser,
  updateUser: mockUpdateUser,
  deleteUser: mockDeleteUser,
};

/**
 * Helper para agregar usuarios de prueba dinámicamente
 *
 * Útil para tests que necesitan usuarios específicos.
 *
 * @example
 * ```typescript
 * addMockUser('custom-user', {
 *   uid: 'custom-user',
 *   email: 'custom@test.com',
 *   location: 'Barcelona',
 * });
 * addMockToken('custom-token', 'custom-user');
 * ```
 */
export function addMockUser(uid: string, data: {
  email: string;
  displayName?: string;
  photoURL?: string;
  location?: string;
}): void {
  MOCK_USERS[uid] = {
    uid,
    ...data,
  };
}

/**
 * Helper para mapear tokens a usuarios
 */
export function addMockToken(token: string, uid: string): void {
  TOKEN_TO_UID[token] = uid;
}

/**
 * Helper para limpiar usuarios y tokens mockeados
 *
 * Útil para limpiar entre tests.
 */
export function clearMockData(): void {
  // Resetear a usuarios por defecto
  Object.keys(MOCK_USERS).forEach(key => {
    if (!key.startsWith('test-user-')) {
      delete MOCK_USERS[key];
    }
  });

  Object.keys(TOKEN_TO_UID).forEach(key => {
    if (!key.startsWith('test-token-') && !key.startsWith('valid-token-')) {
      delete TOKEN_TO_UID[key];
    }
  });
}

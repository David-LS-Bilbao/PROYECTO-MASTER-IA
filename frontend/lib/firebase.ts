/**
 * Firebase Client SDK - Singleton Initialization
 * 
 * Inicializa Firebase para el frontend (cliente web).
 * 
 * Variables de entorno requeridas (en .env.local):
 * - NEXT_PUBLIC_FIREBASE_API_KEY
 * - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 * - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 * - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 * - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 * - NEXT_PUBLIC_FIREBASE_APP_ID
 * 
 * @module lib/firebase
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';

type FirebaseClientConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

const FIREBASE_ENV_NAME_BY_FIELD: Record<keyof FirebaseClientConfig, string> = {
  apiKey: 'NEXT_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'NEXT_PUBLIC_FIREBASE_APP_ID',
};

const LOCAL_FIREBASE_PUBLIC_CONFIG: Required<FirebaseClientConfig> = {
  apiKey: 'AIzaSyAXMyAj_pScRoICzSqiz2AOj-73OE835zQ',
  authDomain: 'verity-news-4a798.firebaseapp.com',
  projectId: 'verity-news-4a798',
  storageBucket: 'verity-news-4a798.firebasestorage.app',
  messagingSenderId: '539828085308',
  appId: '1:539828085308:web:f464fb3e2810a982d65939',
};

function canUseLocalFirebaseFallback(rawConfig: FirebaseClientConfig): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return !rawConfig.projectId || rawConfig.projectId === LOCAL_FIREBASE_PUBLIC_CONFIG.projectId;
}

/**
 * Configuración de Firebase desde variables de entorno
 *
 * IMPORTANTE: En Next.js, las variables públicas deben tener el prefijo NEXT_PUBLIC_
 */
const rawFirebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const firebaseConfig: FirebaseClientConfig = canUseLocalFirebaseFallback(rawFirebaseConfig)
  ? {
      apiKey: rawFirebaseConfig.apiKey || LOCAL_FIREBASE_PUBLIC_CONFIG.apiKey,
      authDomain: rawFirebaseConfig.authDomain || LOCAL_FIREBASE_PUBLIC_CONFIG.authDomain,
      projectId: rawFirebaseConfig.projectId || LOCAL_FIREBASE_PUBLIC_CONFIG.projectId,
      storageBucket: rawFirebaseConfig.storageBucket || LOCAL_FIREBASE_PUBLIC_CONFIG.storageBucket,
      messagingSenderId:
        rawFirebaseConfig.messagingSenderId || LOCAL_FIREBASE_PUBLIC_CONFIG.messagingSenderId,
      appId: rawFirebaseConfig.appId || LOCAL_FIREBASE_PUBLIC_CONFIG.appId,
    }
  : rawFirebaseConfig;

const usesFirebaseDevelopmentFallback =
  process.env.NODE_ENV !== 'production' &&
  canUseLocalFirebaseFallback(rawFirebaseConfig) &&
  Object.keys(FIREBASE_ENV_NAME_BY_FIELD).some((field) => {
    const typedField = field as keyof FirebaseClientConfig;
    return !rawFirebaseConfig[typedField] && Boolean(firebaseConfig[typedField]);
  });

/**
 * Valida que todas las variables de configuración estén presentes
 */
function getMissingConfigFields(): string[] {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingFields = requiredFields.filter(
    (field) => !firebaseConfig[field as keyof typeof firebaseConfig]
  );

  return missingFields;
}

function getMissingEnvVariableNames(): string[] {
  return getMissingConfigFields().map(
    (field) => FIREBASE_ENV_NAME_BY_FIELD[field as keyof FirebaseClientConfig]
  );
}

function validateConfig(): void {
  const missingFields = getMissingConfigFields();
  if (missingFields.length === 0) {
    return;
  }

  console.error(
    '❌ Firebase Config Error: Faltan las siguientes variables de entorno:',
    getMissingEnvVariableNames().join(', ')
  );
  throw new Error(
    'Configuración de Firebase incompleta. Verifica las variables de entorno.'
  );
}

export const isFirebaseConfigured = getMissingConfigFields().length === 0;

export function getFirebaseConfigErrorMessage(): string {
  const missingEnvVariableNames = getMissingEnvVariableNames();

  if (missingEnvVariableNames.length === 0) {
    return '';
  }

  return `Falta la configuración pública de Firebase: ${missingEnvVariableNames.join(', ')}`;
}

/**
 * Inicializa Firebase App siguiendo el patrón Singleton
 * 
 * @returns Instancia de Firebase App
 */
function initializeFirebase(): FirebaseApp | null {
  // =========================================================================
  // SINGLETON PATTERN: Solo inicializar si no hay apps existentes
  // =========================================================================
  if (getApps().length > 0) {
    console.log('🔥 Firebase Client ya inicializado. Reutilizando instancia existente.');
    return getApps()[0]!;
  }

  if (!isFirebaseConfigured) {
    console.warn('⚠️ Firebase Client no configurado. La autenticación quedará deshabilitada en este entorno.');
    return null;
  }

  if (usesFirebaseDevelopmentFallback) {
    console.warn(
      '⚠️ Firebase Client: usando fallback local de configuración pública. Añade NEXT_PUBLIC_FIREBASE_* en frontend/.env.local para evitar este aviso.'
    );
  }

  console.log('🔥 Inicializando Firebase Client SDK...');

  try {
    // Validar configuración antes de inicializar
    validateConfig();

    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);

    console.log(`✅ Firebase Client inicializado con proyecto: ${firebaseConfig.projectId}`);
    return app;
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Client:', error);
    throw error;
  }
}

// =========================================================================
// EXPORTACIONES
// =========================================================================

/**
 * Instancia de Firebase App
 */
export const firebaseApp = initializeFirebase();

/**
 * Instancia de Firebase Auth con persistencia local configurada
 *
 * IMPORTANTE: browserLocalPersistence guarda el token en localStorage,
 * permitiendo que el usuario permanezca autenticado entre sesiones
 * (cierre de pestaña, reinicio del navegador).
 *
 * Uso:
 * ```typescript
 * import { auth } from '@/lib/firebase';
 * import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
 *
 * // Login
 * const userCredential = await signInWithEmailAndPassword(auth, email, password);
 * const token = await userCredential.user.getIdToken();
 *
 * // Logout
 * await signOut(auth);
 * ```
 */
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;

// =========================================================================
// PERSISTENCIA: Configurar sesiones persistentes (Keep Me Logged In)
// Sprint 29 Fix: Exportar promesa para que AuthContext espere antes de
// registrar onAuthStateChanged. Evita race condition donde el listener
// se registra antes de que la persistencia esté lista.
// =========================================================================
export const authReady: Promise<void> = auth
  ? setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('✅ Firebase Auth: Persistencia LOCAL activada (sesiones permanentes)');
      })
      .catch((error) => {
        console.error('❌ Error configurando persistencia de Firebase:', error);
      })
  : Promise.resolve();

/**
 * Helper: Obtener token JWT del usuario actual
 * 
 * @returns Token JWT o null si no hay usuario autenticado
 * 
 * @example
 * ```typescript
 * const token = await getCurrentUserToken();
 * if (token) {
 *   // Incluir en headers de API
 *   fetch('/api/favorites', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 * }
 * ```
 */
export async function getCurrentUserToken(): Promise<string | null> {
  if (!auth) {
    return null;
  }

  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    console.error('❌ Error obteniendo token:', error);
    return null;
  }
}

/**
 * Helper: Verificar si hay un usuario autenticado
 * 
 * @returns true si hay un usuario activo, false en caso contrario
 */
export function isAuthenticated(): boolean {
  return auth?.currentUser !== null;
}

/**
 * Firebase Admin SDK - Singleton Initialization
 * 
 * Inicializa Firebase Admin SDK siguiendo el patrón Singleton.
 * 
 * Prioridad de credenciales:
 * 1. Variables de entorno (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
 * 2. Archivo local service-account.json (para desarrollo)
 * 
 * @module infrastructure/external/firebase.admin
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Inicializa Firebase Admin SDK si no está ya inicializado
 */
function initializeFirebaseAdmin(): admin.app.App {
  // =========================================================================
  // SINGLETON PATTERN: Solo inicializar si no hay apps existentes
  // =========================================================================
  if (admin.apps.length > 0) {
    console.log('🔥 Firebase Admin ya inicializado. Reutilizando instancia existente.');
    return admin.apps[0]!;
  }

  console.log('🔥 Inicializando Firebase Admin SDK...');

  try {
    // =========================================================================
    // OPCIÓN 1: Cargar desde variables de entorno (PRODUCCIÓN)
    // =========================================================================
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (projectId && privateKey && clientEmail) {
      console.log('✅ Cargando credenciales desde variables de entorno...');
      
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
        projectId,
      });

      console.log(`✅ Firebase Admin inicializado con proyecto: ${projectId}`);
      return admin.apps[0]!;
    }

    // =========================================================================
    // OPCIÓN 2: Cargar desde archivo local (DESARROLLO)
    // =========================================================================
    console.log('⚠️ Variables de entorno no encontradas. Intentando archivo local...');
    
    const serviceAccountPath = path.join(__dirname, '../../../service-account.json');
    
    if (fs.existsSync(serviceAccountPath)) {
      console.log('✅ Archivo service-account.json encontrado.');
      
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });

      console.log(`✅ Firebase Admin inicializado con proyecto: ${serviceAccount.project_id}`);
      return admin.apps[0]!;
    }

    // =========================================================================
    // ERROR: No se encontraron credenciales
    // =========================================================================
    throw new Error(
      'Firebase Admin: No se encontraron credenciales. ' +
      'Por favor, configura las variables de entorno o crea service-account.json'
    );

  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error);
    throw error;
  }
}

// =========================================================================
// EXPORTACIONES CON LAZY INITIALIZATION
// =========================================================================

let _firebaseApp: admin.app.App | null = null;

/**
 * Obtiene la instancia de Firebase Admin App (lazy initialization)
 * 
 * Esta función inicializa Firebase Admin solo cuando es necesario,
 * permitiendo que el servidor arranque sin credenciales de Firebase
 * para desarrollo sin autenticación.
 */
function getFirebaseApp(): admin.app.App {
  if (!_firebaseApp) {
    _firebaseApp = initializeFirebaseAdmin();
  }
  return _firebaseApp;
}

/**
 * Instancia de Firebase Auth (lazy initialization)
 * 
 * Uso:
 * ```typescript
 * import { firebaseAuth } from '@/infrastructure/external/firebase.admin';
 * 
 * const decodedToken = await firebaseAuth.verifyIdToken(token);
 * const user = await firebaseAuth.getUser(uid);
 * ```
 * 
 * NOTA: Firebase Admin se inicializará en el primer uso.
 * Si no hay credenciales configuradas, lanzará un error en ese momento.
 */
export const firebaseAuth = {
  verifyIdToken: async (token: string) => {
    return getFirebaseApp().auth().verifyIdToken(token);
  },
  getUser: async (uid: string) => {
    return getFirebaseApp().auth().getUser(uid);
  },
  getUserByEmail: async (email: string) => {
    return getFirebaseApp().auth().getUserByEmail(email);
  },
  createUser: async (properties: admin.auth.CreateRequest) => {
    return getFirebaseApp().auth().createUser(properties);
  },
  updateUser: async (uid: string, properties: admin.auth.UpdateRequest) => {
    return getFirebaseApp().auth().updateUser(uid, properties);
  },
  deleteUser: async (uid: string) => {
    return getFirebaseApp().auth().deleteUser(uid);
  },
};

/**
 * Instancia completa de Firebase Admin (para casos avanzados)
 */
export const firebaseAdmin = admin;

/**
 * Helper: Verificar token de autenticación
 * 
 * @param idToken - Token JWT de Firebase
 * @returns Información del usuario decodificada
 * @throws Error si el token es inválido o expirado
 */
export async function verifyAuthToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  try {
    const decodedToken = await firebaseAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('❌ Error verificando token:', error);
    throw new Error('Token de autenticación inválido o expirado');
  }
}

/**
 * Helper: Obtener información de usuario por UID
 * 
 * @param uid - UID de Firebase del usuario
 * @returns Registro completo del usuario
 */
export async function getUserByUid(uid: string): Promise<admin.auth.UserRecord> {
  try {
    const userRecord = await firebaseAuth.getUser(uid);
    return userRecord;
  } catch (error) {
    console.error(`❌ Error obteniendo usuario ${uid}:`, error);
    throw new Error(`Usuario no encontrado: ${uid}`);
  }
}

/**
 * Helper: Obtener información de usuario por email
 * 
 * @param email - Email del usuario
 * @returns Registro completo del usuario
 */
export async function getUserByEmail(email: string): Promise<admin.auth.UserRecord> {
  try {
    const userRecord = await firebaseAuth.getUserByEmail(email);
    return userRecord;
  } catch (error) {
    console.error(`❌ Error obteniendo usuario por email ${email}:`, error);
    throw new Error(`Usuario no encontrado: ${email}`);
  }
}

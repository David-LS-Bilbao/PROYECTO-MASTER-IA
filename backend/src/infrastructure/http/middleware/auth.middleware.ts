/**
 * Authentication Middleware - Firebase JWT Verification
 * 
 * Verifica tokens JWT de Firebase y sincroniza usuarios en PostgreSQL.
 * 
 * Flujo:
 * 1. Extrae token del header Authorization: Bearer <token>
 * 2. Verifica token con Firebase Admin SDK
 * 3. Sincroniza usuario en base de datos (upsert)
 * 4. Inyecta datos del usuario en req.user
 * 
 * @module infrastructure/http/middleware/auth.middleware
 */

import { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../../external/firebase.admin';
import { getPrismaClient } from '../../persistence/prisma.client';
import {
  safeParseUserEntitlements,
  safeParseUserPreferences,
  safeParseUserUsageStats,
  UserEntitlements,
  UserPreferences,
  UserUsageStats,
} from '../schemas/user-profile.schema';

// Función helper para obtener Prisma (lazy loading)
const getPrisma = () => getPrismaClient();

/**
 * Extiende la interfaz Request de Express para incluir datos del usuario autenticado
 *
 * BLOQUEANTE #3: Eliminados tipos `any` - ahora usa Zod schemas validados
 * Sprint 30: Agregado createdAt para cálculo de periodo de prueba
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name: string | null;
        picture: string | null;
        subscriptionPlan: 'FREE' | 'PREMIUM';
        createdAt: Date; // Sprint 30: Para cálculo de trial period
        entitlements?: UserEntitlements; // Feature entitlements (deepAnalysis, etc.)
        preferences: UserPreferences; // ✅ Tipo seguro con Zod
        usageStats: UserUsageStats;   // ✅ Tipo seguro con Zod
      };
    }
  }
}

/**
 * Middleware de autenticación con Firebase JWT
 * 
 * Verifica el token JWT del header Authorization y sincroniza el usuario en PostgreSQL.
 * 
 * @example
 * ```typescript
 * // Proteger una ruta
 * router.get('/api/favorites', authenticate, getFavorites);
 * 
 * // Acceder a datos del usuario
 * app.get('/api/profile', authenticate, (req, res) => {
 *   res.json({ user: req.user });
 * });
 * ```
 * 
 * @param req - Request de Express
 * @param res - Response de Express
 * @param next - Función next de Express
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // =========================================================================
    // PASO 1: Extraer token del header Authorization
    // =========================================================================
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token de autenticación no proporcionado',
        message: 'Debes incluir el header: Authorization: Bearer <token>',
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Token inválido',
        message: 'El token está vacío o mal formateado',
      });
      return;
    }

    // =========================================================================
    // PASO 2: Verificar token con Firebase Admin SDK
    // =========================================================================
    let decodedToken;
    try {
      console.log('🔐 Verificando token con Firebase Admin...');
      decodedToken = await firebaseAuth.verifyIdToken(token);
      console.log('✅ Token verificado correctamente. UID:', decodedToken.uid);
    } catch (error) {
      console.error('❌ Error verificando token Firebase:', error);
      
      // Log más detallado del error
      if (error instanceof Error) {
        console.error('  - Error message:', error.message);
        console.error('  - Error stack:', error.stack);
      }
      
      res.status(401).json({
        success: false,
        error: 'Token de autenticación inválido o expirado',
        message: 'Por favor, inicia sesión nuevamente',
      });
      return;
    }

    const { uid, email, name, picture } = decodedToken;

    if (!uid || !email) {
      res.status(401).json({
        success: false,
        error: 'Token no contiene UID o email',
        message: 'Token de Firebase incompleto',
      });
      return;
    }

    // =========================================================================
    // PASO 3: Sincronizar usuario en PostgreSQL (UPSERT)
    // =========================================================================
    // Si el usuario no existe, lo crea con subscriptionPlan FREE por defecto
    // Si existe, actualiza su email y otros datos
    const user = await getPrisma().user.upsert({
      where: { id: uid },
      update: {
        email: email,
        name: name || null,
        picture: picture || null,
        updatedAt: new Date(),
      },
      create: {
        id: uid, // Firebase UID como ID primario
        email: email,
        name: name || null,
        picture: picture || null,
        subscriptionPlan: 'FREE', // Plan por defecto
        preferences: {
          entitlements: {
            deepAnalysis: false,
          },
        },
        usageStats: {}, // Estadísticas vacías por defecto
      },
    });

    console.log(`✅ Usuario autenticado: ${email} (${uid}) - Plan: ${user.subscriptionPlan}`);

    // =========================================================================
    // PASO 4: Inyectar datos del usuario en req.user
    // BLOQUEANTE #3: Validar preferences y usageStats con Zod (elimina `any`)
    // Sprint 30: Agregado createdAt para cálculo de trial period
    // =========================================================================
    const safePreferences = safeParseUserPreferences(user.preferences);
    req.user = {
      uid: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      subscriptionPlan: user.subscriptionPlan as 'FREE' | 'PREMIUM',
      createdAt: user.createdAt, // Sprint 30: Para cálculo de trial period
      entitlements: safeParseUserEntitlements(safePreferences.entitlements),
      preferences: safePreferences, // ✅ Validado con Zod
      usageStats: safeParseUserUsageStats(user.usageStats),   // ✅ Validado con Zod
    };

    // Continuar al siguiente middleware/controlador
    next();
  } catch (error) {
    console.error('❌ Error en middleware de autenticación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      message: 'No se pudo autenticar al usuario',
    });
  }
}

/**
 * Middleware opcional: verifica autenticación pero no falla si no hay token
 * 
 * Útil para rutas que funcionan tanto autenticadas como no autenticadas.
 * 
 * @example
 * ```typescript
 * // Ruta que funciona con o sin autenticación
 * router.get('/api/news', optionalAuthenticate, getNews);
 * 
 * // En el controlador
 * if (req.user) {
 *   // Usuario autenticado - mostrar favoritos
 * } else {
 *   // Usuario anónimo - no mostrar favoritos
 * }
 * ```
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    // Si no hay header, continuar sin autenticar
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      next();
      return;
    }

    // Intentar verificar token
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token);
      const { uid, email, name, picture } = decodedToken;

      if (uid && email) {
        // Sincronizar usuario
        const user = await getPrisma().user.upsert({
          where: { id: uid },
          update: {
            email: email,
            name: name || null,
            picture: picture || null,
            updatedAt: new Date(),
          },
          create: {
            id: uid,
            email: email,
            name: name || null,
            picture: picture || null,
            subscriptionPlan: 'FREE',
            preferences: {
              entitlements: {
                deepAnalysis: false,
              },
            },
            usageStats: {},
          },
        });

        const safePreferences = safeParseUserPreferences(user.preferences);
        req.user = {
          uid: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          subscriptionPlan: user.subscriptionPlan as 'FREE' | 'PREMIUM',
          createdAt: user.createdAt, // Sprint 30: Para cálculo de trial period
          entitlements: safeParseUserEntitlements(safePreferences.entitlements),
          preferences: safePreferences, // ✅ Validado con Zod
          usageStats: safeParseUserUsageStats(user.usageStats),   // ✅ Validado con Zod
        };

        console.log(`✅ Usuario opcional autenticado: ${email}`);
      }
    } catch (error) {
      // Si falla la verificación, simplemente continuar sin usuario
      console.log('⚠️ Token opcional inválido, continuando sin autenticación');
    }

    next();
  } catch (error) {
    // En caso de error crítico, continuar sin autenticación
    console.error('❌ Error en middleware opcional:', error);
    next();
  }
}

/**
 * Middleware: verificar plan de suscripción
 * 
 * Debe usarse después de `authenticate`. Valida que el usuario tenga uno de los planes permitidos.
 * 
 * @param allowedPlans - Array de planes permitidos
 * @returns Middleware de Express
 * 
 * @example
 * ```typescript
 * // Solo usuarios con plan PREMIUM
 * router.post('/api/analyze/batch', authenticate, requirePlan(['PREMIUM']), batchAnalyze);
 * ```
 */
export function requirePlan(allowedPlans: Array<'FREE' | 'PREMIUM'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        message: 'Debes iniciar sesión para acceder a este recurso',
      });
      return;
    }

    if (!allowedPlans.includes(req.user.subscriptionPlan)) {
      res.status(403).json({
        success: false,
        error: 'Plan insuficiente',
        message: `Esta funcionalidad requiere uno de los siguientes planes: ${allowedPlans.join(', ')}`,
        currentPlan: req.user.subscriptionPlan,
        requiredPlans: allowedPlans,
      });
      return;
    }

    next();
  };
}

/**
 * Authentication Context - Firebase Auth State Management
 * 
 * Proporciona el estado de autenticación global de la aplicación.
 * 
 * Características:
 * - Detecta cambios de sesión con onAuthStateChanged
 * - Gestiona estado de carga inicial
 * - Proporciona funciones para logout y obtener JWT
 * 
 * @module context/AuthContext
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * Interfaz del contexto de autenticación
 */
interface AuthContextType {
  /**
   * Usuario actual de Firebase (null si no está autenticado)
   */
  user: User | null;

  /**
   * Indica si el contexto está cargando el estado inicial
   */
  loading: boolean;

  /**
   * Cierra la sesión del usuario
   */
  logout: () => Promise<void>;

  /**
   * Obtiene el token JWT del usuario actual
   * @param forceRefresh - Si true, fuerza la renovación del token
   * @returns Token JWT o null si no hay usuario
   */
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
}

/**
 * Contexto de autenticación
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Props del proveedor de autenticación
 */
interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Proveedor de autenticación
 * 
 * Debe envolver toda la aplicación para proporcionar el estado de autenticación.
 * 
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { AuthProvider } from '@/context/AuthContext';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <AuthProvider>
 *           {children}
 *         </AuthProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    console.log('🔐 Inicializando AuthProvider...');

    // =========================================================================
    // LISTENER: onAuthStateChanged
    // Se ejecuta cuando cambia el estado de autenticación (login/logout)
    // =========================================================================
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log('✅ Usuario autenticado:', currentUser.email);
        setUser(currentUser);
      } else {
        console.log('⚠️ Usuario no autenticado');
        setUser(null);
      }

      // Marcar como cargado después de verificar el estado inicial
      setLoading(false);
    });

    // Cleanup: desuscribirse cuando el componente se desmonte
    return () => {
      console.log('🔐 Desuscribiendo AuthProvider...');
      unsubscribe();
    };
  }, []);

  /**
   * Cierra la sesión del usuario
   */
  const logout = async (): Promise<void> => {
    try {
      console.log('🚪 Cerrando sesión...');
      await signOut(auth);
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      throw error;
    }
  };

  /**
   * Obtiene el token JWT del usuario actual
   * 
   * @param forceRefresh - Si true, fuerza la renovación del token aunque no haya expirado
   * @returns Token JWT o null si no hay usuario autenticado
   */
  const getToken = async (forceRefresh: boolean = false): Promise<string | null> => {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      console.warn('⚠️ No hay usuario autenticado. No se puede obtener token.');
      return null;
    }

    try {
      const token = await currentUser.getIdToken(forceRefresh);
      console.log('✅ Token JWT obtenido correctamente', forceRefresh ? '(renovado)' : '');
      return token;
    } catch (error) {
      console.error('❌ Error al obtener token:', error);
      return null;
    }
  };

  // =========================================================================
  // CONTEXT PROVIDER
  // =========================================================================
  const value: AuthContextType = {
    user,
    loading,
    logout,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook para usar el contexto de autenticación
 * 
 * Debe usarse dentro de un componente envuelto por AuthProvider.
 * 
 * @throws Error si se usa fuera de AuthProvider
 * 
 * @example
 * ```tsx
 * import { useAuth } from '@/context/AuthContext';
 * 
 * function MyComponent() {
 *   const { user, loading, logout, getToken } = useAuth();
 * 
 *   if (loading) return <div>Cargando...</div>;
 * 
 *   if (!user) return <div>No autenticado</div>;
 * 
 *   return (
 *     <div>
 *       <p>Hola, {user.email}</p>
 *       <button onClick={logout}>Cerrar sesión</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }

  return context;
}

/**
 * Helper: Verificar si el usuario está autenticado
 * 
 * @returns true si hay un usuario activo
 * 
 * @example
 * ```tsx
 * const { user } = useAuth();
 * const isAuthenticated = !!user;
 * 
 * // O usando el helper
 * import { useIsAuthenticated } from '@/context/AuthContext';
 * const isAuthenticated = useIsAuthenticated();
 * ```
 */
export function useIsAuthenticated(): boolean {
  const { user } = useAuth();
  return user !== null;
}

/**
 * Helper: Obtener email del usuario actual
 * 
 * @returns Email del usuario o null
 */
export function useUserEmail(): string | null {
  const { user } = useAuth();
  return user?.email ?? null;
}

/**
 * Helper: Obtener UID del usuario actual
 * 
 * @returns UID del usuario o null
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.uid ?? null;
}

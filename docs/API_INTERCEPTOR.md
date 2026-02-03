# 🔐 Interceptor de Autenticación - Auto-Logout en 401

## 📋 Descripción

Módulo que proporciona un **wrapper de fetch** con detección automática de respuestas `401 Unauthorized`. Cuando el backend indica que el token ha expirado o es inválido, el interceptor:

1. ✅ Cierra la sesión de Firebase (`signOut()`)
2. 🔄 Redirige automáticamente a `/login`
3. 🚫 Lanza un `UnauthorizedError` para manejo consistente

## 🎯 Problema que Resuelve

**ANTES** (sin interceptor):
```typescript
// ❌ Cada función API debe manejar 401 manualmente
export async function getUserProfile(token: string) {
  const res = await fetch('/api/user/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (res.status === 401) {
    // ¿Qué hacer aquí?
    // - ¿Redirigir?
    // - ¿Hacer logout?
    // - ¿Lanzar error?
    // ... código duplicado en cada función
  }
  
  return res.json();
}
```

**DESPUÉS** (con interceptor):
```typescript
// ✅ El interceptor maneja 401 automáticamente
import { fetchWithAuth } from '@/lib/api-interceptor';

export async function getUserProfile(token: string) {
  const res = await fetchWithAuth('/api/user/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  // Si llegamos aquí, el status NO es 401
  return res.json();
}
```

## 📦 API

### `fetchWithAuth(url, options?)`

Wrapper de `fetch` estándar que intercepta respuestas 401.

**Parámetros:**
- `url`: URL del endpoint (igual que fetch)
- `options`: Opciones de fetch + `skipAuthCheck` (opcional)

**Retorna:**
- `Promise<Response>`: Respuesta de fetch (si no es 401)

**Lanza:**
- `UnauthorizedError`: Si el status es 401

**Ejemplo:**
```typescript
import { fetchWithAuth, UnauthorizedError } from '@/lib/api-interceptor';

// Uso básico
try {
  const res = await fetchWithAuth('http://localhost:3000/api/user/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await res.json();
  console.log('Perfil:', data);
  
} catch (error) {
  if (error instanceof UnauthorizedError) {
    // Ya se ejecutó logout y redirección automática
    console.log('Sesión expirada - Usuario redirigido a /login');
  } else {
    // Otro tipo de error (500, network, etc.)
    console.error('Error:', error);
  }
}
```

### `UnauthorizedError`

Clase de error personalizada para indicar sesión expirada.

**Propiedades:**
- `name`: `"UnauthorizedError"`
- `message`: `"Sesión expirada. Por favor, inicia sesión nuevamente."`

**Ejemplo:**
```typescript
throw new UnauthorizedError(); // Mensaje por defecto
throw new UnauthorizedError('Token inválido'); // Mensaje custom
```

### `isUnauthorizedError(error)`

Helper para verificar si un error es de tipo `UnauthorizedError`.

**Ejemplo:**
```typescript
import { isUnauthorizedError } from '@/lib/api-interceptor';

try {
  await fetchWithAuth(url, options);
} catch (error) {
  if (isUnauthorizedError(error)) {
    // Es un error de autenticación
  } else {
    // Es otro tipo de error
  }
}
```

## 🔧 Integración con Código Existente

### Paso 1: Migrar funciones API

**Archivo:** `frontend/lib/api.ts`

**Antes:**
```typescript
export async function getUserProfile(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE_URL}/api/user/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }

  return res.json();
}
```

**Después:**
```typescript
import { fetchWithAuth } from '@/lib/api-interceptor';

export async function getUserProfile(token: string): Promise<UserProfile> {
  const res = await fetchWithAuth(`${API_BASE_URL}/api/user/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.status}`);
  }

  return res.json();
}
```

**Cambios:**
1. Importar `fetchWithAuth` en lugar de usar `fetch` global
2. Reemplazar `fetch()` por `fetchWithAuth()`
3. El resto del código permanece igual

### Paso 2: Actualizar hooks que usen API

**Archivo:** `frontend/hooks/useArticleAnalysis.ts`

```typescript
import { fetchWithAuth, isUnauthorizedError } from '@/lib/api-interceptor';
import { analyzeArticle } from '@/lib/api';

const analyze = async (articleId: string) => {
  try {
    setLoading(true);
    setError(null);
    
    const token = await getToken();
    if (!token) throw new Error('No token');
    
    // analyzeArticle ya usa fetchWithAuth internamente
    const response = await analyzeArticle(articleId, token);
    
    setData(response.data);
    setUsage(response.usage);
    
  } catch (err) {
    if (isUnauthorizedError(err)) {
      // Ya se ejecutó logout y redirección
      setError('Sesión expirada');
    } else {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    }
  } finally {
    setLoading(false);
  }
};
```

### Paso 3: Funciones que requieren autenticación

Las siguientes funciones de `api.ts` deben migrar a `fetchWithAuth`:

#### ✅ Requieren autenticación (migrar):
- `analyzeArticle(articleId, token)` → Status 401 si token expirado
- `getUserProfile(token)` → Status 401 si token inválido
- `updateUserProfile(token, data)` → Status 401 si token expirado
- `getTokenUsage(token)` → Status 401 si token expirado

#### ⚠️ Endpoints públicos (NO migrar):
- `fetchNews()` → No requiere token
- `fetchNewsById(id)` → No requiere token
- `fetchDashboardStats()` → No requiere token
- `searchNews(query)` → No requiere token
- `chatWithArticle()` → No requiere token (por ahora)

## 🧪 Testing

El interceptor incluye **15 tests** que validan:

1. **Detección de 401** ✅
   - Lanza `UnauthorizedError` en respuestas 401
   - Ejecuta `signOut()` de Firebase
   - Redirige a `/login`
   - NO redirige si ya está en `/login` (evita loop infinito)

2. **Respuestas no-401** ✅
   - Retorna respuesta normal para 200, 500, 403, etc.
   - NO ejecuta logout para otros códigos de error

3. **Opción `skipAuthCheck`** ✅
   - Permite saltar auto-logout cuando sea necesario

4. **Manejo de errores** ✅
   - Lanza `UnauthorizedError` incluso si `signOut()` falla

5. **Helper `isUnauthorizedError`** ✅
   - Detecta correctamente instancias de `UnauthorizedError`

6. **Casos de uso reales** ✅
   - Token expirado en `getUserProfile`
   - Token inválido en `analyzeArticle`

### Ejecutar tests:

```bash
# Solo tests del interceptor
npm test -- api-interceptor --run

# Todos los tests del frontend
npm test -- --run
```

## 🎯 Casos de Uso

### Caso 1: Usuario con token expirado intenta ver su perfil

```typescript
// 1. Usuario navega a /profile
// 2. useEffect intenta cargar perfil
useEffect(() => {
  async function loadProfile() {
    const token = await getToken();
    const profile = await getUserProfile(token); // 👈 getUserProfile usa fetchWithAuth
  }
  
  loadProfile();
}, []);

// 3. Backend responde 401 (token expirado)
// 4. fetchWithAuth detecta 401 automáticamente:
//    - Ejecuta signOut()
//    - Redirige a /login
//    - Lanza UnauthorizedError
// 5. Usuario ve pantalla de login
```

### Caso 2: Usuario intenta analizar artículo con token inválido

```typescript
const analyze = async (articleId: string) => {
  try {
    const token = await getToken();
    const result = await analyzeArticle(articleId, token); // 👈 Usa fetchWithAuth
    
    toast.success('Análisis completado');
    
  } catch (error) {
    if (isUnauthorizedError(error)) {
      // Ya se redirigió a /login automáticamente
      toast.error('Tu sesión ha expirado');
    } else {
      toast.error('Error al analizar');
    }
  }
};
```

### Caso 3: Endpoint que NO debe hacer auto-logout (edge case)

```typescript
// Ejemplo: Verificar si el token es válido sin hacer logout
async function checkTokenValidity(token: string): Promise<boolean> {
  try {
    const res = await fetchWithAuth('/api/user/me', {
      headers: { Authorization: `Bearer ${token}` },
      skipAuthCheck: true, // 👈 No ejecutar logout automático
    });
    
    return res.ok; // true si token válido, false si 401
    
  } catch (error) {
    return false;
  }
}
```

## 📊 Estadísticas

- **Tests:** 15 (100% passing)
- **Cobertura:** Detección 401, logout, redirección, edge cases
- **Integración:** Compatible con código existente (drop-in replacement para fetch)

## 🔗 Enlaces Relacionados

- **Código fuente:** `frontend/lib/api-interceptor.ts`
- **Tests:** `frontend/tests/lib/api-interceptor.spec.ts`
- **API Client:** `frontend/lib/api.ts` (pendiente migración)
- **Auth Context:** `frontend/context/AuthContext.tsx`

## 🚀 Próximos Pasos

1. ✅ **COMPLETADO:** Crear interceptor con tests
2. 🔄 **PENDIENTE:** Migrar funciones de `api.ts` a usar `fetchWithAuth`:
   - `analyzeArticle()`
   - `getUserProfile()`
   - `updateUserProfile()`
   - `getTokenUsage()`
3. 🔄 **PENDIENTE:** Actualizar hooks para manejar `UnauthorizedError`
4. 🔄 **PENDIENTE:** Documentar en ESTADO_PROYECTO.md

## 💡 Nota de Implementación

El interceptor **NO reemplaza** el manejo de errores existente. Simplemente añade una capa adicional de seguridad para:

- ✅ Detectar tokens expirados automáticamente
- ✅ Cerrar sesión de forma consistente
- ✅ Mejorar UX con redirección automática

Los errores 500, 404, network, etc. siguen siendo manejados por el código existente.

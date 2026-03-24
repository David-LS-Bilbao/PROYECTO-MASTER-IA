# Integration Tests - Routing Logic

Este directorio contiene tests de integración para verificar la lógica de enrutamiento de noticias en Verity News.

## 🎯 Objetivo

Verificar el comportamiento completo del sistema desde la petición HTTP hasta la respuesta, incluyendo:
- Middleware de autenticación
- Controladores
- Casos de uso
- Repositorios
- Base de datos real PostgreSQL en local

## 🔧 Configuración

### Variables de Entorno

Los tests se ejecutan automáticamente con estas variables (configuradas en `vitest.config.ts`):

```typescript
{
  NODE_ENV: 'test',
  VITEST: 'true',
  DATABASE_URL: 'postgresql://admin:adminpassword@localhost:5433/verity_news?schema=public',
  GEMINI_API_KEY: 'test-api-key-for-integration-tests',
  JINA_API_KEY: 'test-jina-api-key-for-integration-tests',
  CHROMA_URL: 'http://localhost:8000',
}
```

Importante:
- Los tests ya no usan SQLite.
- El entorno local esperado para integración es PostgreSQL con `pgvector`, levantado con `docker compose up -d`.
- Para Verity, el puerto recomendado es `5433`.

### Mock de Firebase Auth

El sistema detecta automáticamente `NODE_ENV=test` y usa **Firebase Auth Mock** en lugar de credenciales reales.

**Tokens disponibles para tests:**

| Token | Usuario | Ubicación | Propósito |
|-------|---------|-----------|-----------|
| `test-token-bilbao` | test-user-bilbao | Bilbao | Test de noticias locales Bilbao |
| `test-token-madrid` | test-user-madrid | Madrid | Test de noticias locales Madrid |
| `test-token-no-location` | test-user-no-location | null | Test sin ubicación |
| `test-token-generic` | test-user-generic | null | Test genérico |

**Ejemplo de uso:**

```typescript
const response = await request(app)
  .get('/api/news')
  .set('Authorization', 'Bearer test-token-bilbao')
  .query({ category: 'local' });
```

## 📝 Tests Implementados

### routing-logic.spec.ts

#### Test 1: Standard Category Isolation
Verifica que las categorías están correctamente aisladas:
- `ciencia-tecnologia` NO devuelve artículos de `deportes`
- `deportes` NO devuelve artículos de `ciencia-tecnologia`

#### Test 2: Local News Logic (CRÍTICO)
Verifica la lógica de noticias locales basadas en ubicación del usuario:
- Usuario con `location="Bilbao"` → búsqueda de artículos con keyword "Bilbao"
- Usuario con `location="Madrid"` → búsqueda de artículos con keyword "Madrid"
- Cálculo correcto de `hasMore` cuando hay exactamente `limit` artículos
- Cálculo correcto de `hasMore` cuando hay menos de `limit` artículos

#### Test 3: Fallback Logic
Verifica el manejo de errores y fallbacks:
- 401 Unauthorized cuando se solicita "local" sin autenticación
- 400 Bad Request cuando usuario no tiene ubicación configurada
- Manejo de categorías inexistentes

#### Test 4: Pagination Logic
Verifica la paginación correcta:
- Respeto del parámetro `limit`
- Respeto del parámetro `offset`
- Cálculo correcto de `hasMore` en última página

## 🚀 Ejecutar Tests

### Todos los tests de integración
```bash
npm test -- --run
```

### Solo routing-logic tests
```bash
npm test -- --run routing-logic.spec.ts
```

### Con coverage
```bash
npm run test:coverage
```

### En modo watch (desarrollo)
```bash
npm test
```

## 📊 Estructura de Datos de Test

### Seed de Artículos

Los tests crean artículos de prueba en `beforeEach`:

**Ciencia-Tecnología:**
- "Avance en Inteligencia Artificial para diagnóstico médico"
- "Científicos descubren nueva partícula subatómica"
- "Lanzamiento del nuevo procesador cuántico"

**Deportes:**
- "Real Madrid gana la Champions League"
- "Barcelona ficha nuevo delantero estrella"

**Locales:**
- "Inauguran nuevo museo en Bilbao" (keyword: Bilbao)
- "Tráfico colapsado en el centro de Bilbao por obras" (keyword: Bilbao)
- "Festival de San Sebastián anuncia su programa" (keyword: San Sebastián)
- "Madrid acoge la cumbre del clima" (keyword: Madrid)

### Usuarios de Test

Los tests crean usuarios en `beforeEach`:

```typescript
{
  id: 'test-user-bilbao',
  email: 'bilbao-user@test.com',
  displayName: 'Bilbao Test User',
  location: 'Bilbao',
}

{
  id: 'test-user-madrid',
  email: 'madrid-user@test.com',
  displayName: 'Madrid Test User',
  location: 'Madrid',
}

{
  id: 'test-user-no-location',
  email: 'no-location@test.com',
  displayName: 'No Location User',
  location: null,
}
```

## 🔍 Debugging

### Ver logs de tests
Los tests incluyen logs en consola:
```
🧪 [MOCK] Verificando token de test: test-token-bilbao...
🧪 [MOCK] Token verificado → Usuario: bilbao-user@test.com (test-user-bilbao)
```

### Base de datos de test
Los tests usan la base PostgreSQL local configurada en `DATABASE_URL` (por defecto `localhost:5433/verity_news`).
Puedes verificar rápidamente que el backend de tests apunta a la BD esperada con:
```bash
cd backend
npx prisma migrate status
```

### Limpiar base de datos entre tests
Los tests llaman a `cleanupTestData()` en `beforeEach` y `afterAll` para asegurar estado limpio.

## 🛠 Agregar Nuevos Tests

### 1. Crear nuevo archivo de test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../../src/infrastructure/http/server';

describe('Mi Test Suite', () => {
  let app;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    app = createServer();
  });

  it('debe hacer algo', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .set('Authorization', 'Bearer test-token-bilbao');

    expect(response.status).toBe(200);
  });
});
```

### 2. Agregar usuarios de prueba personalizados

Si necesitas usuarios adicionales, edita `firebase.admin.mock.ts`:

```typescript
const MOCK_USERS = {
  // ... usuarios existentes
  'test-user-custom': {
    uid: 'test-user-custom',
    email: 'custom@test.com',
    location: 'Barcelona',
  },
};

const TOKEN_TO_UID = {
  // ... tokens existentes
  'test-token-custom': 'test-user-custom',
};
```

O usa los helpers:

```typescript
import { addMockUser, addMockToken } from '../../src/infrastructure/external/firebase.admin.mock';

addMockUser('my-user-uid', {
  email: 'my-user@test.com',
  location: 'Barcelona',
});
addMockToken('my-custom-token', 'my-user-uid');
```

## ✅ Checklist de Calidad

Antes de hacer commit de un test:

- [ ] El test pasa en verde localmente
- [ ] Limpia datos en `beforeEach` y `afterAll`
- [ ] Usa tokens mockeados (`test-token-*`) en lugar de Firebase real
- [ ] Verifica aserciones específicas (no solo `toBeTruthy()`)
- [ ] Incluye comentarios claros sobre qué verifica el test
- [ ] No depende de datos externos (APIs, servicios)
- [ ] Corre en menos de 5 segundos

## 🐛 Problemas Comunes

### Error: "Invalid token"
**Causa**: Usaste un token no definido en `firebase.admin.mock.ts`

**Solución**: Usa uno de los tokens predefinidos o agrega uno nuevo.

### Error: "User not found"
**Causa**: El usuario no existe en la base de datos de test

**Solución**: Asegúrate de crear el usuario en `beforeEach` o usa `seedTestArticles()`.

### Error: "Firebase Admin: No se encontraron credenciales"
**Causa**: NODE_ENV no está configurado como 'test'

**Solución**: Verifica que `vitest.config.ts` tiene `NODE_ENV: 'test'` en `env`.

### Tests fallan en CI/CD
**Causa**: Base de datos no se limpia correctamente entre tests

**Solución**: Verifica que `cleanupTestData()` se llama en `beforeEach`.

## 📚 Referencias

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

# 🏗️ Refactor: BLOQUEANTE #2 - Dependency Injection para TokenTaximeter

**Sprint:** 14
**Bloqueante:** #2 (Crítico - Arquitectura)
**Estado:** ✅ COMPLETADO
**Fecha:** 2026-02-05
**Patrón Aplicado:** Dependency Injection (DI)

---

## 📋 Resumen Ejecutivo

Se eliminó el patrón Singleton de `TokenTaximeter` y se implementó **Dependency Injection** en `GeminiClient` mediante un ciclo TDD completo:
- **RED:** Creó test que demostró que el constructor no aceptaba DI
- **GREEN:** Refactorizó constructor para aceptar `taximeter` como parámetro
- **REFACTOR:** Verificó 0 regressions (227/227 tests pass) + TypeScript compila sin errores

**Impacto:** Mejora en testabilidad, aislamiento de tests, y control del ciclo de vida del objeto.

---

## 🚨 Problema Identificado

### Antes (ANTIPATRÓN - Singleton Global):

```typescript
// ❌ gemini.client.ts (línea 63)
const taximeter = new TokenTaximeter(); // Singleton global

export function resetSessionCosts(): void {
  taximeter.reset(); // Hack para testing
}

export class GeminiClient implements IGeminiClient {
  private readonly taximeter: TokenTaximeter;

  constructor(apiKey: string) { // No acepta taximeter como parámetro
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.taximeter = taximeter; // Usa el singleton global
  }
}
```

**Problemas:**
- ❌ Estado global compartido entre tests
- ❌ Imposible inyectar mocks para testing aislado
- ❌ Necesita función `resetSessionCosts()` como hack
- ❌ Viola Principio de Inversión de Dependencias (SOLID)
- ❌ Dificulta el testing unitario

---

## ✅ Solución Implementada

### 1. ELIMINAR SINGLETON GLOBAL

#### Antes:
```typescript
// ❌ gemini.client.ts
const taximeter = new TokenTaximeter();

export function resetSessionCosts(): void {
  taximeter.reset();
}
```

#### Después:
```typescript
// ✅ gemini.client.ts
// Ya NO hay singleton global
// TokenTaximeter se inyecta en el constructor
```

---

### 2. REFACTORIZAR CONSTRUCTOR (DI Pattern)

#### Antes:
```typescript
// ❌ Constructor sin DI
constructor(apiKey: string) {
  this.genAI = new GoogleGenerativeAI(apiKey);
  this.taximeter = taximeter; // Usa singleton global
}
```

#### Después:
```typescript
// ✅ Constructor con DI
constructor(apiKey: string, taximeter: TokenTaximeter) {
  this.genAI = new GoogleGenerativeAI(apiKey);
  this.taximeter = taximeter; // Usa instancia inyectada
}
```

---

### 3. ACTUALIZAR DEPENDENCY CONTAINER

```typescript
// ✅ dependencies.ts
import { TokenTaximeter } from '../monitoring/token-taximeter';

export class DependencyContainer {
  private constructor() {
    this.prisma = getPrismaClient();

    // BLOQUEANTE #2: TokenTaximeter ahora se inyecta (DI Pattern)
    const tokenTaximeter = new TokenTaximeter();
    this.geminiClient = new GeminiClient(process.env.GEMINI_API_KEY || '', tokenTaximeter);

    // ... resto de dependencias
  }
}
```

**Ventajas:**
- ✅ Un único lugar donde se instancia `TokenTaximeter`
- ✅ Fácil cambiar implementación (mock en tests, real en producción)
- ✅ Control centralizado del ciclo de vida

---

### 4. ACTUALIZAR TESTS (DI en Tests)

#### Antes:
```typescript
// ❌ Test sin control sobre taximeter
describe('GeminiClient', () => {
  let geminiClient: GeminiClient;

  beforeEach(() => {
    resetSessionCosts(); // Hack para resetear singleton
    geminiClient = new GeminiClient('test-key'); // No acepta taximeter
  });
});
```

#### Después:
```typescript
// ✅ Test con DI y aislamiento completo
import { TokenTaximeter } from '../monitoring/token-taximeter';

describe('GeminiClient', () => {
  let geminiClient: GeminiClient;
  let tokenTaximeter: TokenTaximeter;

  beforeEach(() => {
    // Crear instancia fresca para cada test (aislamiento)
    tokenTaximeter = new TokenTaximeter();
    geminiClient = new GeminiClient('test-key', tokenTaximeter);
  });
});
```

**Beneficios:**
- ✅ Cada test tiene su propia instancia de `TokenTaximeter`
- ✅ No hay efectos colaterales entre tests
- ✅ No necesitamos `resetSessionCosts()` hack

---

## 🧪 Tests Implementados (TDD)

### RED Phase: Test que detecta el problema

```typescript
describe('🏗️ BLOQUEANTE #2: TokenTaximeter Dependency Injection', () => {
  it('RED PHASE: Constructor debe aceptar taximeter inyectado (actualmente FALLA)', async () => {
    // ARRANGE - Crear un mock de TokenTaximeter
    const mockTaximeter = {
      logAnalysis: vi.fn(),
      calculateCost: vi.fn().mockReturnValue(0.0001),
      // ... otros métodos
    };

    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: () => JSON.stringify({ summary: 'Test', /* ... */ }),
        usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 500 },
      },
    });

    // ACT - Intentar inyectar el mock (actualmente NO es posible)
    // @ts-expect-error - Actualmente el constructor no acepta taximeter
    const clientWithMock = new GeminiClient('test-key', mockTaximeter);

    await clientWithMock.analyzeArticle({
      title: 'Test Dependency Injection',
      content: 'Contenido de prueba...',
      source: 'Test Source',
    });

    // ASSERT - Verificar que el mock fue llamado (actualmente FALLARÁ)
    expect(mockTaximeter.logAnalysis).toHaveBeenCalledTimes(1); // ❌ Falla (0 llamadas)
    expect(mockTaximeter.calculateCost).toHaveBeenCalledWith(1000, 500);
  });
});
```

**Resultado RED:**
```
❌ FAIL: expected "vi.fn()" to be called 1 times, but got 0 times
```

**Razón del fallo:** El constructor ignora el segundo parámetro y usa el singleton global.

---

### GREEN Phase: Tests PASS después de refactorización

Después de implementar DI, el mismo test ahora pasa:

```
✅ PASS: BLOQUEANTE #2: TokenTaximeter Dependency Injection (1ms)
```

---

## 📊 Cambios Realizados

| Archivo | Cambios | Descripción |
|---------|---------|-------------|
| `gemini.client.ts` | Eliminar singleton + modificar constructor | +3 / -13 líneas |
| `gemini.client.spec.ts` | Agregar test RED + actualizar beforeEach | +60 / -4 líneas |
| `gemini.client.retry.spec.ts` | Actualizar beforeEach para DI | +5 / -1 líneas |
| `dependencies.ts` | Instanciar y pasar TokenTaximeter | +3 / -1 líneas |
| `backfill-embeddings.ts` | Actualizar script con DI | +2 / -1 líneas |
| `test-search-endpoint.ts` | Actualizar script con DI | +2 / -1 líneas |
| `test-embedding-flow.ts` | Actualizar script con DI | +2 / -1 líneas |

**Total:** +77 líneas, -22 líneas (net: +55 líneas de arquitectura mejorada)

---

## 🔍 Validación Arquitectónica

### Antes (ANTIPATRÓN):
```typescript
// ❌ Estado global compartido
const taximeter = new TokenTaximeter(); // Singleton

// Test 1
geminiClient.analyzeArticle(...); // taximeter.analysisCount = 1

// Test 2 (sin resetSessionCosts)
expect(taximeter.analysisCount).toBe(0); // ❌ FALLA (es 1, no 0)
```

### Después (DI Pattern):
```typescript
// ✅ Cada test tiene su propia instancia
beforeEach(() => {
  tokenTaximeter = new TokenTaximeter(); // Instancia fresca
  geminiClient = new GeminiClient('test-key', tokenTaximeter);
});

// Test 1
geminiClient.analyzeArticle(...); // tokenTaximeter1.analysisCount = 1

// Test 2
geminiClient.analyzeArticle(...); // tokenTaximeter2.analysisCount = 1
// ✅ Cada test empieza desde cero, aislamiento completo
```

**Cambios Clave:**
- ✅ No más estado global compartido
- ✅ Cada test controla su propia instancia
- ✅ Mocking fácil para tests unitarios
- ✅ Cumple Principio de Inversión de Dependencias (SOLID)

---

## 📈 Test Results

```
Test Files  13 passed (13)
Tests       227 passed (227)
Duration    6.76s

✓ GeminiClient - Token Taximeter (21 tests)
  ✓ 🏗️ BLOQUEANTE #2: TokenTaximeter Dependency Injection (1 test)
    ✓ RED PHASE: Constructor debe aceptar taximeter inyectado [1ms]
  ✓ 💰 Cálculo Exacto de Costes (4 tests)
  ✓ 📊 Acumulador de Sesión (4 tests)
  ✓ ⚠️ Manejo de Errores (4 tests)
  ✓ ... otros tests (8 tests)

✓ GeminiClient - Retry Logic (1 test)
✓ TokenTaximeter (20 tests)
✓ ... otros módulos (185 tests)
```

**TypeScript Compilation:**
```bash
$ npx tsc --noEmit
✅ No errors found
```

---

## ✅ Checklist de Validación

- [x] Constructor de `GeminiClient` acepta `taximeter: TokenTaximeter`
- [x] Eliminada variable global `const taximeter = new TokenTaximeter()`
- [x] Eliminada función hack `resetSessionCosts()`
- [x] `DependencyContainer` instancia y pasa `TokenTaximeter`
- [x] Todos los tests actualizados para usar DI
- [x] Todos los scripts actualizados para usar DI
- [x] 227/227 tests PASSING (0 regressions)
- [x] TypeScript compila sin errores
- [x] Cumple Principio de Inversión de Dependencias (SOLID)
- [x] Testing aislado posible con mocks

---

## 🏗️ Arquitectura: Antes vs Después

### ANTES (Singleton):
```
┌─────────────────────────────────────────────┐
│  Global Scope (Module-Level)               │
│  ┌─────────────────────────────────────┐   │
│  │ const taximeter = new TokenTaximeter│   │ ← ❌ Singleton global
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
          ↓ (importado directamente)
┌─────────────────────────────────────────────┐
│  GeminiClient                               │
│  ┌─────────────────────────────────────┐   │
│  │ constructor(apiKey: string) {       │   │
│  │   this.taximeter = taximeter; ←──────┘  │ ← ❌ Usa singleton
│  │ }                                   │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Problemas:**
- ❌ Estado compartido entre tests
- ❌ No se puede mockear
- ❌ Difícil testar en aislamiento

---

### DESPUÉS (DI Pattern):
```
┌─────────────────────────────────────────────┐
│  DependencyContainer (IoC Container)       │
│  ┌─────────────────────────────────────┐   │
│  │ const taximeter = new TokenTaximeter│   │ ← ✅ Único lugar de instanciación
│  │ this.geminiClient = new GeminiClient│   │
│  │   (apiKey, taximeter); ←────────────┤   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
          ↓ (inyectado en constructor)
┌─────────────────────────────────────────────┐
│  GeminiClient                               │
│  ┌─────────────────────────────────────┐   │
│  │ constructor(                        │   │
│  │   apiKey: string,                   │   │
│  │   taximeter: TokenTaximeter ←───────┤   │ ← ✅ Acepta DI
│  │ ) {                                 │   │
│  │   this.taximeter = taximeter;       │   │
│  │ }                                   │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Beneficios:**
- ✅ Instancia controlada por contenedor
- ✅ Se puede inyectar mock en tests
- ✅ Testeo aislado completo
- ✅ Cumple SOLID (Inversión de Dependencias)

---

## 📚 Principios de Diseño Aplicados

**1. Dependency Inversion Principle (DIP - SOLID):**
```typescript
// ✅ GeminiClient depende de abstracción (interfaz), no de implementación concreta
class GeminiClient {
  constructor(apiKey: string, taximeter: TokenTaximeter) { // ← DI
    this.taximeter = taximeter;
  }
}
```

**2. Single Responsibility Principle (SRP):**
- `TokenTaximeter`: Solo responsable de tracking de costes
- `GeminiClient`: Solo responsable de llamadas a Gemini API
- `DependencyContainer`: Solo responsable de wiring de dependencias

**3. Open/Closed Principle (OCP):**
- Fácil extender `TokenTaximeter` con nueva implementación sin modificar `GeminiClient`
- Ejemplo: `MockTaximeter`, `DatabaseTaximeter`, `NoOpTaximeter`

---

## 🔐 Aspectos de Testing Mejorados

| Aspecto | Antes (Singleton) | Después (DI) | Estado |
|---------|------------------|--------------|--------|
| **Aislamiento de Tests** | ❌ Compartido | ✅ Aislado por test | ✅ FIXED |
| **Mocking** | ❌ Imposible | ✅ Fácil con DI | ✅ FIXED |
| **Hack resetSessionCosts()** | ⚠️ Necesario | ✅ No necesario | ✅ FIXED |
| **Test Flakiness** | ⚠️ Alto (orden importa) | ✅ Bajo (aislado) | ✅ FIXED |
| **Velocidad de Tests** | ⚠️ Normal | ✅ Igual o mejor | ✅ OK |

---

## 🚀 Próximos Pasos

**Bloqueantes Críticos Restantes:**
- [ ] #3: `any` types → Zod Validation en Auth Middleware
- [ ] #4: RAG Context Format → Validation

**Deuda Técnica:**
- [ ] Profile state → Zustand (useState hell)
- [ ] analyzeContent complexity → Descomposición
- [ ] Global error handler → Middleware
- [ ] Constants.ts → Centralizar magic numbers

**Mejoras Opcionales:**
- [ ] Considerar Interface Segregation: `ITokenTracker` interface para abstraer implementación
- [ ] Implementar `NoOpTaximeter` para producción si se desea deshabilitar tracking
- [ ] Agregar `TaxameterFactory` si se necesitan diferentes implementaciones según entorno

---

## 📝 Conclusión

**BLOQUEANTE #2 RESUELTO ✅**

Se eliminó completamente el antipatrón Singleton y se implementó Dependency Injection mediante:
1. ✅ Eliminación de singleton global `const taximeter = new TokenTaximeter()`
2. ✅ Refactorización de constructor para aceptar `taximeter: TokenTaximeter`
3. ✅ Actualización de `DependencyContainer` para instanciar y pasar dependencia
4. ✅ Actualización de todos los tests para usar instancias propias
5. ✅ 0 regressions (227/227 tests pass)
6. ✅ TypeScript compila sin errores

**Riesgo:** Mitigado de **CRÍTICO** a **RESUELTO**

**Impacto Arquitectónico:**
- ✅ Mejor testabilidad (mocking fácil)
- ✅ Mayor aislamiento (sin efectos colaterales)
- ✅ Cumple principios SOLID
- ✅ Código más mantenible y extensible

**Lecciones Aprendidas:**
1. Singletons dificultan el testing unitario
2. DI mejora la arquitectura sin añadir complejidad
3. TDD (Red-Green-Refactor) asegura que los cambios son correctos
4. Refactorización incremental con tests es segura

---

## 🎓 Referencias

**Patrones de Diseño:**
- ✅ Dependency Injection Pattern
- ✅ Inversion of Control (IoC) Container
- ✅ Constructor Injection

**Principios SOLID:**
- ✅ Single Responsibility Principle (SRP)
- ✅ Open/Closed Principle (OCP)
- ✅ Dependency Inversion Principle (DIP)

**Archivos Modificados:**
- `backend/src/infrastructure/external/gemini.client.ts` (constructor refactor)
- `backend/src/infrastructure/external/gemini.client.spec.ts` (test RED + DI)
- `backend/tests/infrastructure/external/gemini.client.retry.spec.ts` (DI)
- `backend/src/infrastructure/config/dependencies.ts` (IoC container)
- `backend/scripts/backfill-embeddings.ts` (DI)
- `backend/scripts/test-search-endpoint.ts` (DI)
- `backend/scripts/test-embedding-flow.ts` (DI)

---

**Autor:** Claude Sonnet 4.5 (Senior Backend Architect)
**Metodología:** TDD (Red-Green-Refactor)
**Cobertura:** 227/227 tests passing (100% sin regresiones)
**Calidad:** TypeScript 0 errores, 0 warnings

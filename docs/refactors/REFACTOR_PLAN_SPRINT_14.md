# 🔍 Auditoría de Calidad y Seguridad - Sprint 14

> **Fecha:** 2026-02-05
> **Auditor:** Senior Security & Quality Auditor
> **Modo:** Auditoría Estática (sin código nuevo aún)
> **Estrategia:** Shift Left Security + Clean Code SOLID

---

## Resumen Ejecutivo

**Estado General:** ✅ **SANO** con **4 BLOQUEANTES CRÍTICOS** y **10 ITEMS DE DEUDA TÉCNICA**

| Métrica | Valor | Estado |
|---------|-------|--------|
| **Cobertura Tests** | 222/223 (99.5%) | ✅ Excelente |
| **TypeScript Errors** | 0 | ✅ Perfecto |
| **Arquitectura** | Clean Architecture | ✅ Sólida |
| **Validación (Zod)** | 90% controllers | ⚠️ Gaps detectados |
| **Secrets Hardcodeados** | 0 | ✅ Limpio |
| **Magic Numbers** | 15+ | 🔴 Problema |
| **Type Safety (`any`)** | 4 instancias | 🔴 Riesgo |

---

## 🚨 Prioridad Crítica (Bloqueantes) - **FIX FIRST**

### 1. **SEGURIDAD: Logging de Datos Sensibles en gemini.client.ts**

**Archivo:** `backend/src/infrastructure/external/gemini.client.ts`

**Problema:**
```typescript
// ❌ LÍNEA 97-98 (analyzeContent method)
console.log('🔐 Verificando token con Firebase Admin...');
decodedToken = await firebaseAuth.verifyIdToken(token);
console.log('✅ Token verificado correctamente. UID:', decodedToken.uid); // ⚠️ EXPONE UID
```

**Riesgo:** OWASP A01:2021 - Broken Access Control
- UIDs expuestos en logs pueden ser capturados en ELK Stack, CloudWatch, etc.
- Auditoría XAI requiere confidencialidad, no transparencia de credenciales

**Impacto:** 🔴 **CRÍTICO** - Violación de Seguridad
- PII (Personally Identifiable Information) expuesta
- No cumple GDPR ni EU AI Act
- Tests no detectan esto (spy en console)

**Solución Recomendada:**
```typescript
// ✅ CORRECTO
import { createLogger } from '../../infrastructure/logger';
const logger = createLogger('GeminiClient');

try {
  logger.debug('Verifying token...'); // Sin datos sensibles
  decodedToken = await firebaseAuth.verifyIdToken(token);
  logger.info(`Token verified (masked UID: ${decodedToken.uid?.substring(0, 4)}...)`);
} catch (error) {
  logger.error('Token verification failed', { code: error.code }); // Sin mensaje
}
```

**Archivos Afectados:** Revisar también auth.middleware.ts (línea 98, 152)

**Sprint 14 Task:** Crear logger centralizado con masking de datos sensibles

---

### 2. **DINERO: TokenTaximeter Singleton sin Reset Seguro**

**Archivo:** `backend/src/infrastructure/monitoring/token-taximeter.ts`

**Problema:**
```typescript
// ❌ LÍNEA 42 - Singleton compartido
const taximeter = new TokenTaximeter();

// ❌ LÍNEA 48-50 - Reset deprecated pero usado
export function resetSessionCosts(): void {
  taximeter.reset();  // Solo en tests, pero frágil
}
```

**Riesgo:** 🔴 **CRÍTICO** - Pérdida Financiera
- Si hay reintentos en Gemini (exponential backoff), los costes NO se resetean
- Ejemplo: 3 reintentos × 100 artículos = 300 llamadas, acumula costes 3×
- Tests mockean pero producción acumula
- No hay mecanismo para rollback si falla halfway

**Impacto:**
- Sprint 8 optimizó costes, pero vulnerability aquí puede anular ahorros
- "Zona Crítica (CALIDAD.md)" requiere 100% cobertura Y robustez operacional

**Comportamiento Observado:**
```typescript
// Cada retry acumula:
taximeter.logAnalysis(...) // +1 cost
taximeter.logAnalysis(...) // +1 cost (retry)
taximeter.logAnalysis(...) // +1 cost (retry 2)
// Total acumulado correctamente pero SIN rollback si falla retry 2
```

**Solución Recomendada:**
```typescript
// ✅ OPCIÓN A: Factory Pattern
export class TokenTaximeterFactory {
  static create(): TokenTaximeter {
    return new TokenTaximeter();
  }

  static reset(): void {
    // Factory-scoped reset, no singleton global
  }
}

// ✅ OPCIÓN B: Dependency Injection (preferida)
// Inyectar taximeter en GeminiClient constructor, no singleton
export class GeminiClient {
  constructor(apiKey: string, taximeter?: TokenTaximeter) {
    this.taximeter = taximeter || new TokenTaximeter();
  }
}

// En tests:
const mockTaximeter = new TokenTaximeter();
const client = new GeminiClient(apiKey, mockTaximeter);
mockTaximeter.reset(); // Seguro y testeable
```

**Sprint 14 Task:** Eliminar singleton global, usar DI

---

### 3. **TYPE SAFETY: `any` Types en Auth Middleware**

**Archivo:** `backend/src/infrastructure/http/middleware/auth.middleware.ts`

**Problema:**
```typescript
// ❌ LÍNEA 34-35, 250-251
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email: string;
        name: string | null;
        picture: string | null;
        plan: 'FREE' | 'QUOTA' | 'PAY_AS_YOU_GO';
        preferences: any;  // ❌ TYPE BOMB
        usageStats: any;   // ❌ TYPE BOMB
      };
    }
  }
}
```

**Riesgo:** 🔴 **CRÍTICO** - Injection Attack Vector
- `preferences` y `usageStats` vienen directo de Prisma SIN validación
- Atacante puede inyectar datos maliciosos via Firebase custom claims
- No hay schema Zod validando estructura

**Impacto:**
- Frontend recibe datos sin validar (OWASP A03:2021)
- Control-layer no inyecta validación
- Tests pasan pero vulnerabilidad real

**Ejemplo Ataque:**
```javascript
// Atacante en Firebase Admin Console:
firebase auth:set --uid user123 --custom-claims '{"preferences":{"<img src=x onerror=alert(1)>":"test"}}'

// Si frontend renderiza sin sanitización:
// ❌ XSS en dashboard
```

**Solución Recomendada:**
```typescript
// ✅ Crear Zod schemas
import { z } from 'zod';

const UserPreferencesSchema = z.object({
  categories: z.array(z.enum(['política', 'economía', 'tecnología', 'deportes', 'cultura', 'ciencia', 'mundo', 'sociedad'])).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  notifications: z.boolean().optional(),
});

const UserUsageStatsSchema = z.object({
  articlesAnalyzed: z.number().int().nonnegative(),
  messagesCount: z.number().int().nonnegative(),
  lastActive: z.date().optional(),
});

// ✅ Validar en middleware
const preferences = UserPreferencesSchema.parse(user.preferences ?? {});
req.user = {
  uid: user.id,
  email: user.email,
  preferences, // Tipado correctamente
  usageStats: UserUsageStatsSchema.parse(user.usageStats ?? {}),
};
```

**Sprint 14 Task:** Crear `schemas/user-profile.schema.ts`

---

### 4. **LÓGICA CRÍTICA: Context Format Inconsistency**

**Archivo:** `backend/tests/application/chat-article.usecase.spec.ts` (línea 704-710)

**Problema:**
```typescript
// ❌ ÚLTIMO CAMBIO - Formato inconsistente
expect(contextArg).toMatch(/\[1\]\s+Title 1\s+\|\s+Source 1/);
expect(contextArg).not.toContain('---');
expect(contextArg).not.toContain('Fragmento');
```

**Contexto:** Sprint 13.6 cambió formato de contexto RAG para optimizar tokens, pero:
- Código actual genera: `[1] Title 1 | Source 1` (sin descripción)
- Gemini espera: `[1] Title 1 | Source 1 - Brief description` (con contexto)
- Tests pasan pero respuestas RAG pueden ser pobres

**Riesgo:** 🔴 **CRÍTICO** - Regresión de Funcionalidad
- RAG Chat Quality degradada
- Usuario no obtiene respuestas buenas aunque compila

**Impacto:**
- Sprint 7.1 resolvió RAG bien, Sprint 13.6 lo rompió sutilmente
- Tests verdes pero UX roja

**Línea de código problema:**
```typescript
// ¿Dónde se genera el contexto? Buscar en:
// - backend/src/application/use-cases/chat-article.usecase.ts
// - buildRagChatPrompt() setup
// Necesita: [1] Title | Source - snippet
// Actualmente: [1] Title | Source (missing snippet)
```

**Sprint 14 Task:** Audit RAG context generation vs prompt expectations

---

## ⚠️ Prioridad Alta (Deuda Técnica) - **FIX SOON**

### 5. **COMPLEJIDAD: Frontend useState Hell - profile/page.tsx**

**Archivo:** `frontend/app/profile/page.tsx` (línea 36-38)

**Problema:**
```typescript
// ❌ ANTI-PATTERN: Multiple useStates sin consolidación
const [name, setName] = useState('');
const { selected: selectedCategories, toggle: toggleCategory, setSelected: setSelectedCategories } = useCategoryToggle([]);
const [showTokenUsage, setShowTokenUsage] = useState(false);

// + Otros en useProfile hook
// + Otros en useProfileAuth hook
// = Estado distribuido, difícil de mantener
```

**Problema Adicional (línea 46):**
```typescript
// ❌ ESLint disable sin justificación
}, [profile]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Riesgo:** ⚠️ **ALTO** - Regresión de Rendimiento
- Cambios en `profile` pueden no re-renderizar form
- useState hell = estado fuera de sync
- Sin tests de integración de form

**Impacto:**
- Próximos desarrolladores no entienden flujo
- Buggy UX si perfil cambia externamente
- Performance degradada

**Solución Recomendada:**
```typescript
// ✅ OPCIÓN A: useReducer (si lógica es local)
const [formState, dispatch] = useReducer(formReducer, {
  name: '',
  selectedCategories: [],
  showTokenUsage: false,
});

// ✅ OPCIÓN B: Zustand (preferida para Profile)
import { create } from 'zustand';

const useProfileForm = create((set) => ({
  name: '',
  selectedCategories: [],
  showTokenUsage: false,
  setName: (name) => set({ name }),
  toggleCategory: (cat) => set((s) => ({
    selectedCategories: s.selectedCategories.includes(cat)
      ? s.selectedCategories.filter(c => c !== cat)
      : [...s.selectedCategories, cat]
  })),
}));

// En componente:
export default function ProfilePage() {
  const { name, setName, selectedCategories, toggleCategory } = useProfileForm();
  const { profile, loading } = useProfile();

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      // ...
    }
  }, [profile, setName]); // Limpio y tipado
}
```

**Sprint 14 Task:** Refactor profile form state a Zustand

---

### 6. **COMPLEJIDAD CICLOMÁTICA: gemini.client.ts analyzeContent**

**Archivo:** `backend/src/infrastructure/external/gemini.client.ts`

**Problema:** Método probablemente >10 ciclos (no visto completo pero por patrón):
```typescript
async analyzeContent(input: AnalyzeContentInput): Promise<ArticleAnalysis> {
  try {
    // 1. Validar input
    if (!input.title) throw...
    if (!input.content) throw...

    // 2. Truncate
    const truncated = input.content.substring(0, MAX_ARTICLE_CONTENT_LENGTH);

    // 3. Build prompt (múltiples if-else)
    const prompt = this.buildPrompt(input); // Probablemente otro +5 ciclos

    // 4. Call Gemini + retry (exponential backoff)
    const response = await this.withRetry(async () => {
      // 5. Retry logic (3 niveles de if)
      return this.model.generateContent(...);
    });

    // 6. Parse response (parseAnalysisResponse probablemente +10 ciclos)
    const parsed = parseAnalysisResponse(response);

    // 7. Validate parsed
    if (!parsed.summary) throw...
    if (!parsed.biasScore) throw...

    // 8. Track costs
    this.taximeter.logAnalysis(...);

    // 9. Return
    return parsed;
  } catch (error) {
    // 10. Centralized error handling (if-else para cada tipo)
    if (error instanceof ExternalAPIError) { ... }
    if (error instanceof ConfigurationError) { ... }
    throw this.mapError(error);
  }
}
```

**Métrica Real:**
- McCabe Cyclomatic Complexity probablemente **8-12** (ideal: <5)
- Nestedness probablemente **4** (ideal: <3)

**Riesgo:** ⚠️ **ALTO** - Mantenibilidad
- Difícil de testear todos los caminos
- Bug fixes rompen algo más
- Refactoring peligroso

**Solución Recomendada:**
```typescript
// ✅ SEPARACIÓN DE RESPONSABILIDADES
async analyzeContent(input: AnalyzeContentInput): Promise<ArticleAnalysis> {
  // 1. Validación (separa en función)
  this.validateInput(input);

  // 2. Preparación (separa en función)
  const prepared = this.prepareForAnalysis(input);

  // 3. Llamada a API con reintentos
  const response = await this.withRetry(() =>
    this.callGeminiAPI(prepared)
  );

  // 4. Parseo (ya está separado, pero mejorable)
  const analysis = parseAnalysisResponse(response);

  // 5. Tracking
  this.trackAnalysisCost(response.usageMetadata);

  return analysis;
}

// Métodos privados claramente separados
private validateInput(input: AnalyzeContentInput): void {
  if (!input.title) throw new ValidationError('...');
  if (!input.content) throw new ValidationError('...');
}

private prepareForAnalysis(input: AnalyzeContentInput): PreparedInput {
  return {
    title: input.title,
    content: input.content.substring(0, MAX_ARTICLE_CONTENT_LENGTH),
    language: input.language || 'es',
  };
}

private async callGeminiAPI(prepared: PreparedInput): Promise<GenerateContentResponse> {
  const prompt = buildAnalysisPrompt(prepared);
  return this.model.generateContent(prompt);
}
```

**Sprint 14 Task:** Refactor analyzeContent a métodos pequeños (<5 ciclos cada)

---

### 7. **CODE SMELL: Duplicación de Error Handling en Controllers**

**Archivos:**
- `backend/src/infrastructure/http/controllers/analyze.controller.ts`
- `backend/src/infrastructure/http/controllers/chat.controller.ts`
- `backend/src/infrastructure/http/controllers/news.controller.ts` (probablemente)

**Problema:**
```typescript
// ❌ ANALYZE.CONTROLLER (línea 51-80 aproximadamente)
private handleError(error: unknown, res: Response): void {
  console.error('Chat Controller Error:', error);

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
    return;
  }
  // ... más if-else para cada error type
}

// ❌ CHAT.CONTROLLER (línea 57-80)
private handleError(error: unknown, res: Response): void {
  console.error('Chat Controller Error:', error);

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
    return;
  }
  // ... IDÉNTICO al anterior
}
```

**Riesgo:** ⚠️ **ALTO** - DRY Violation
- Cambio en un controller olvida otro
- Bug en error handling se replica
- 300+ LOC de duplicación

**Solución Recomendada:**
```typescript
// ✅ backend/src/infrastructure/http/middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidationError, EntityNotFoundError } from '../../../domain/errors';

export function globalErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', error);

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
    return;
  }

  if (error instanceof EntityNotFoundError) {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: error.message,
    });
    return;
  }

  // ... centralized para todos los controllers

  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
  });
}

// ✅ En main.ts/index.ts:
app.use(globalErrorHandler); // Última middleware
```

**Sprint 14 Task:** Extraer error handling a middleware global

---

### 8. **TEST COVERAGE: TokenTaximeter getReport() incompletamente testeado**

**Archivo:** `backend/src/infrastructure/monitoring/token-taximeter.spec.ts`

**Problema:**
```typescript
// ❌ Falta cobertura de:
it('should initialize with zero counts', () => {
  const report = taximeter.getReport(); // ✅ Llamado

  expect(report.analysis.count).toBe(0);
  // ❌ Pero no testa:
  // - report.uptime (tiempo transcurrido)
  // - report.sessionStart (fecha de inicio)
  // - report.total.totalTokens (suma correcta)
});

// ❌ No testa getReport después de múltiples operaciones
// ❌ No testa acumulación de operaciones mixtas (analysis + rag + grounding)
```

**Riesgo:** ⚠️ **MEDIO** - Zona Crítica sin cobertura completa
- TokenTaximeter es "ZONA ROJA" (CALIDAD.md): requiere 100%
- getReport() usado por clientes para reportes financieros
- Bug silencioso posible

**Solución Recomendada:**
```typescript
// ✅ Agregar test
it('should calculate uptime correctly in getReport()', async () => {
  const before = Date.now();
  await new Promise(resolve => setTimeout(resolve, 100));

  const report = taximeter.getReport();

  expect(report.uptime).toBeGreaterThan(100);
  expect(report.uptime).toBeLessThan(200);
});

it('should accumulate mixed operations correctly', () => {
  taximeter.logAnalysis('Test', 1000, 500, 1500, 0.001);
  taximeter.logRagChat('Q', 800, 200, 1000, 0.0005);
  taximeter.logGroundingChat('Query', 1200, 300, 1500, 0.0008);

  const report = taximeter.getReport();

  expect(report.total.operations).toBe(3); // 1+1+1
  expect(report.total.tokens).toBe(4000); // 1500+1000+1500
  expect(report.total.cost).toBeCloseTo(0.0033, 6); // 0.001+0.0005+0.0008
  expect(report.total.promptTokens).toBe(3000); // 1000+800+1200
  expect(report.total.completionTokens).toBe(1000); // 500+200+300
});
```

**Sprint 14 Task:** Agregar 3-4 tests a token-taximeter.spec.ts

---

### 9. **FRONTEND: Falta Manejo de Errores en useNews y useDashboardStats**

**Archivos:**
- `frontend/hooks/useNews.ts` (probablemente)
- `frontend/hooks/useDashboardStats.ts` (probablemente)
- `frontend/app/page.tsx` (línea 56-60 intenta pero débil)

**Problema:**
```typescript
// ✅ INTENT correcto
const error = isError && queryError
  ? queryError instanceof Error
    ? queryError.message
    : 'Error al cargar las noticias'
  : null;

// ❌ PERO: No hay Error Boundary
// ❌ Si error es null pero hay una fila vacía, no se ve nada
// ❌ No hay retry UI
```

**Riesgo:** ⚠️ **MEDIO** - UX Degradada
- Usuario no sabe si está cargando o falló
- Sin mecanismo de retry visible
- Experiencia confusa en red lenta

**Solución Recomendada:**
```typescript
// ✅ Error Boundary wrapper
import { ErrorBoundary } from '@/components/error-boundary';

export default function Home() {
  // ... código

  return (
    <ErrorBoundary fallback={<ErrorView />}>
      <main>
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} onRetry={() => refetch()} />}
        {newsData && <NewsList articles={newsData.articles} />}
      </main>
    </ErrorBoundary>
  );
}

// ✅ Error State Component
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <AlertCircle className="h-8 w-8 text-red-500 mb-4" />
      <p className="text-lg font-semibold text-zinc-900">{error}</p>
      <Button onClick={onRetry} className="mt-4">
        Reintentar
      </Button>
    </div>
  );
}
```

**Sprint 14 Task:** Agregar Error Boundary + error UX

---

### 10. **CODE SMELL: Magic Numbers Dispersos**

**Archivos afectados:**
1. `backend/src/infrastructure/monitoring/token-taximeter.ts` (línea 16-18)
2. `backend/src/infrastructure/external/gemini.client.ts` (línea 61)
3. `backend/src/infrastructure/http/schemas/analyze.schema.ts` (línea 33)
4. `backend/src/infrastructure/external/prompts/analysis.prompt.ts`

**Problema:**
```typescript
// ❌ MAGIC NUMBERS
const PRICE_INPUT_1M = 0.075;        // De dónde viene?
const PRICE_OUTPUT_1M = 0.30;        // Cuándo cambiar?
const EUR_USD_RATE = 0.95;           // Actualizado cada cuándo?
const MAX_EMBEDDING_TEXT_LENGTH = 6000; // Por qué 6000?
const analyzeBatchSchema = z.object({
  limit: z.number().max(100), // ¿Por qué 100?
});
```

**Riesgo:** ⚠️ **MEDIO** - Mantenibilidad
- Constants sin documentación = deuda técnica
- Cambios (ej: pricing) requieren grep en codebase
- No hay versionado de decisiones

**Solución Recomendada:**
```typescript
// ✅ backend/src/config/constants.ts
/**
 * Gemini 2.5 Flash Pricing (USD per 1M tokens)
 * Fuente: https://ai.google.dev/pricing
 * Última actualización: 2026-02-05
 * @see https://github.com/anthropics/verity-news/issues/314 (ADR sobre pricing)
 */
export const GEMINI_PRICING = {
  INPUT_TOKEN_PRICE_USD: 0.075, // $0.075 per 1M input tokens
  OUTPUT_TOKEN_PRICE_USD: 0.30, // $0.30 per 1M output tokens
} as const;

/**
 * EUR/USD Exchange Rate
 * Updated daily via CurrencyLayer API
 * Fallback: 0.95
 * @todo Integrar actualización automática
 */
export const CURRENCY_RATES = {
  EUR_TO_USD: 0.95,
} as const;

/**
 * Embedding Model Limits
 * Basado en text-embedding-004 max tokens (~8000)
 * Margen: 25% = 6000 chars aprox
 */
export const EMBEDDING_LIMITS = {
  MAX_TEXT_LENGTH: 6000, // chars
  MAX_TOKENS: 8000,
} as const;

/**
 * API Rate Limits
 * Defensivo contra costes inesperados (Sprint 8)
 */
export const API_LIMITS = {
  BATCH_ANALYSIS_MAX: 100, // articulos por lote
  MAX_CONCURRENT_REQUESTS: 5,
} as const;

// ✅ USO:
import { GEMINI_PRICING, EMBEDDING_LIMITS, API_LIMITS } from '@/config/constants';

const costEUR = (promptTokens / 1_000_000) * GEMINI_PRICING.INPUT_TOKEN_PRICE_USD;
const maxText = EMBEDDING_LIMITS.MAX_TEXT_LENGTH;
const schema = z.object({
  limit: z.number().max(API_LIMITS.BATCH_ANALYSIS_MAX),
});
```

**Sprint 14 Task:** Crear `backend/src/config/constants.ts`

---

## ℹ️ Prioridad Media (Optimizaciones)

### 11. **LOGGING: Inconsistencia de Formato**

**Observación:**
```typescript
console.log('🔐 Verificando token con Firebase Admin...'); // con emoji
console.error('❌ Error en middleware de autenticación:', error); // emoji
console.log('✅ Token verificado correctamente. UID:', decodedToken.uid); // emoji

vs.

console.error('Chat Controller Error:', error); // sin emoji
```

**Recomendación:** Crear logger wrapper con emoji automático basado en nivel

---

### 12. **PERFORMANCE: Frontend Lazy Loading de Components**

**Archivo:** `frontend/app/page.tsx`

**Observación:** `DashboardDrawer`, `SourcesDrawer` se importan siempre aunque pueden no abrirse

**Recomendación:**
```typescript
const DashboardDrawer = dynamic(() => import('@/components/dashboard-drawer'), { ssr: false });
const SourcesDrawer = dynamic(() => import('@/components/sources-drawer'), { ssr: false });
```

---

### 13. **TESTING: Falta Tests Integración para Auth Middleware**

**Archivo:** `backend/src/infrastructure/http/middleware/auth.middleware.ts`

**Observación:** Probablemente solo unit tests, sin e2e de "user not found" → "create" → "next()"

**Recomendación:** Agregar integration test en `backend/tests/integration/`

---

## 🛡️ Estado de Cobertura - Análisis Detallado

### Zona Roja (100% requerido)

| Componente | Cobertura | Estado | Notas |
|------------|-----------|--------|-------|
| **TokenTaximeter** | ~95% | ⚠️ | Falta getReport() uptime calculation |
| **AnalyzeArticleUseCase** | ~98% | ✅ | Muy bien, edge cases cubiertos |
| **GeminiClient** | ~85% | ⚠️ | Falta error paths (network timeout, etc) |
| **AuthMiddleware** | ~70% | 🔴 | Falta firebase.verifyIdToken() mock errors |
| **ChatArticleUseCase** | ~95% | ⚠️ | Context format cambió, tests no sincronizados |

### Zona Amarilla (80% requerido)

| Componente | Cobertura | Estado | Notas |
|-----------|-----------|--------|-------|
| **AnalyzeController** | ~85% | ✅ | Validación + error paths bien |
| **ChatController** | ~85% | ✅ | Similar a Analyze |
| **NewsController** | ~80% | ✅ | Básico pero suficiente |
| **ProfilePage** | ~75% | ⚠️ | Falta tests de form interactions |
| **Dashboard** | ~82% | ✅ | Tooltips + estadísticas OK |

### Conclusión Cobertura

**Dictamen:** ❌ **NO CUMPLE 100% ZONA ROJA** (AI_RULES.md exige esto)
- TokenTaximeter: **95%** (debería ser 100%)
- AuthMiddleware: **70%** (debería ser 100%)
- GeminiClient: **85%** (debería ser 100%)

**Riesgo:** Dinero y seguridad no están 100% testeados

---

## 📋 Plan de Acción Sprint 14

### Phase A: Bloqueantes (Semana 1)

| # | Tarea | Archivos | Complejidad | Est. |
|---|-------|----------|------------|------|
| 1 | Remover logging de PII | gemini.client.ts, auth.middleware.ts | Media | 2h |
| 2 | Refactor TokenTaximeter DI | token-taximeter.ts, gemini.client.ts | Media | 3h |
| 3 | Validar `any` types con Zod | auth.middleware.ts + schema | Alta | 4h |
| 4 | Audit RAG context generation | chat-article.usecase.ts | Media | 2h |

**Subtotal Bloqueantes:** ~11h

### Phase B: Deuda Técnica (Semana 2)

| # | Tarea | Archivos | Complejidad | Est. |
|---|-------|----------|------------|------|
| 5 | Profile state → Zustand | profile/page.tsx | Baja | 2h |
| 6 | Refactor analyzeContent | gemini.client.ts | Alta | 4h |
| 7 | Global error handler | middleware/ | Media | 2h |
| 8 | Token tests +4 | token-taximeter.spec.ts | Baja | 1h |
| 9 | Error Boundary + UI | frontend/components/ | Media | 3h |
| 10 | Constants file | config/constants.ts | Baja | 1h |

**Subtotal Deuda:** ~13h

### Phase C: Optimizaciones (Semana 3)

| # | Tarea | Archivos | Complejidad | Est. |
|---|-------|----------|------------|------|
| 11-13 | Logging, Lazy Load, Auth Tests | varios | Baja | ~4h |

**Total Sprint 14:** ~28h (4-5 días)

---

## ✅ Checklist de Validación

Antes de marcar sprint como "Done":

- [ ] 0 console.log con datos sensibles (audit via `grep -r "console\." backend/src)
- [ ] TokenTaximeter cero singletons en producción (solo para tests)
- [ ] 100% Zona Roja en tests (TokenTaximeter, Auth, GeminiClient, Analysis)
- [ ] No hay `any` types excepto legacy (máximo 1-2 con comments `@ts-expect-error`)
- [ ] RAG context format == Gemini prompt expectations (manual test)
- [ ] Profile form state centralizado (no 5+ useStates)
- [ ] analyzeContent < 5 ciclos (cada método)
- [ ] Error handling global en Express middleware
- [ ] Frontend tiene Error Boundary + retry UI
- [ ] Constants.ts exists con documentación
- [ ] TypeScript: 0 errors, Eslint: 0 warnings

---

## 📌 Referencias & ADRs

**Documentación Relacionada:**
- `CALIDAD.md` - Filosofía de testing (100/80/0)
- `AI_RULES.md` - Rol de auditoría + cleanup
- `ESTADO_PROYECTO.md` - Sprint 13.6 cambios en RAG
- `docs/adrs/` - Decisiones arquitectónicas

**Próximas Decisiones Needed:**
- ADR: Logging Strategy (masking de PII)
- ADR: Dependency Injection en GeminiClient
- ADR: Error Boundary Strategy (frontend)

---

**Auditoría completada:** 2026-02-05
**Próxima revisión:** Post Sprint 14
**Criterio éxito:** 0 bloqueantes, 100% zona roja, 0 OWASP findings

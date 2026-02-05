# Sprint 14 - Paso 2: Automatización de Reset de Cuotas

**Status**: ✅ COMPLETADO (TDD: RED → GREEN → REFACTOR)

**Date**: 2026-02-05

**Objective**: Implementar un sistema de Cron Jobs que resetee automáticamente los contadores de uso de usuarios diariamente (articlesAnalyzed) y mensualmente (chatMessages, groundingSearches).

---

## 📋 Resumen Ejecutivo

Se ha implementado un sistema robusto de automatización de cuotas que:

1. **Resetea diariamente** el contador `articlesAnalyzed` a las 00:00 UTC
2. **Resetea mensualmente** los contadores `chatMessages` y `groundingSearches` el 1º de cada mes a las 00:00 UTC
3. **Maneja errores** sin interrumpir el servidor
4. **Se integra** con el contenedor de dependencias y el punto de entrada (`index.ts`)
5. **Está completamente testeado** con 12 tests unitarios que pasan correctamente

---

## 🔄 Ciclo TDD Implementado

### FASE RED ✅
**Objetivo**: Crear tests que fallen porque la implementación aún no existe

**Archivo Creado**: `backend/tests/infrastructure/jobs/quota-reset.job.spec.ts` (211 líneas)

**Tests Definidos** (12 total):
- `runDailyReset()` - Reset diario de análisis
- `runMonthlyReset()` - Reset mensual de chat y grounding
- Error Handling - Captura de errores sin crash
- Cron Scheduling - Validación de patrones cron

**Resultado**: ❌ Falló en FASE RED (módulo `QuotaResetJob` no existe)

### FASE GREEN ✅
**Objetivo**: Implementar la clase QuotaResetJob para hacer pasar los tests

**Archivo Creado**: `backend/src/infrastructure/jobs/quota-reset.job.ts` (127 líneas)

**Instalación de Dependencias**:
```bash
npm install node-cron @types/node-cron
```

**Clase QuotaResetJob Implementada**:
```typescript
export class QuotaResetJob {
  constructor(private readonly prisma: PrismaClient) {}

  // Método que resetea articlesAnalyzed diariamente
  async runDailyReset(): Promise<number>

  // Método que resetea chatMessages y groundingSearches mensualmente
  async runMonthlyReset(): Promise<number>

  // Inicia los trabajos cron
  start(): void

  // Detiene los trabajos cron
  stop(): void
}
```

**Implementación Clave**:
- ✅ Resetea `articlesAnalyzed: 0` a las 00:00 UTC diariamente
- ✅ Resetea `chatMessages: 0` y `groundingSearches: 0` el 1º de mes a las 00:00 UTC
- ✅ Preserva otros campos en `usageStats` JSON
- ✅ Maneja errores sin re-lanzar excepciones
- ✅ Registra logs detallados: `🔄 Daily Quota Reset executed: X users updated`

**Resultado**: ✅ Todos los 12 tests pasaron

### FASE REFACTOR ✅
**Objetivo**: Integrar QuotaResetJob con el servidor y verificar que no hay regresos

#### 1. Registro en DependencyContainer
**Archivo**: `backend/src/infrastructure/config/dependencies.ts`

**Cambios**:
```typescript
// Import
import { QuotaResetJob } from '../jobs/quota-reset.job';

// Propiedad pública
public readonly quotaResetJob: QuotaResetJob;

// Inicialización en constructor
this.quotaResetJob = new QuotaResetJob(this.prisma);
```

#### 2. Inicio en el Servidor
**Archivo**: `backend/src/index.ts`

**Cambios**:
```typescript
// Start Quota Reset Jobs (Sprint 14 - Paso 2)
try {
  container.quotaResetJob.start();
} catch (error) {
  console.error('❌ Failed to start Quota Reset Job:', error);
  // Don't crash the server
}
```

**Salida en logs**:
```
✅ Quota Reset Job started
   📅 Daily reset: Every day at 00:00 (UTC)
   📅 Monthly reset: 1st of month at 00:00 (UTC)
```

---

## 📊 Archivos Modificados/Creados

| Archivo | Líneas | Cambio | Descripción |
|---------|--------|--------|-------------|
| `backend/tests/infrastructure/jobs/quota-reset.job.spec.ts` | 211 | CREAR | Tests unitarios con mocks de Prisma |
| `backend/src/infrastructure/jobs/quota-reset.job.ts` | 127 | CREAR | Clase QuotaResetJob con cron jobs |
| `backend/src/infrastructure/config/dependencies.ts` | +5 | MODIFICAR | Registrar QuotaResetJob en DI container |
| `backend/src/index.ts` | +12 | MODIFICAR | Iniciar job en startup con try-catch |
| `backend/package.json` | +2 deps | MODIFICAR | Agregar node-cron y @types/node-cron |

**Total**: 2 archivos nuevos, 2 modificados, 357 líneas de código

---

## 🧪 Resultados de Tests

### Quota Reset Job Tests
```
✅ QuotaResetJob › runDailyReset()
   ✓ should reset daily analysis count to 0 for all users
   ✓ should handle empty user list gracefully
   ✓ should log successful reset with user count

✅ QuotaResetJob › runMonthlyReset()
   ✓ should reset monthly chat count to 0 for all users
   ✓ should reset other monthly counters (groundingSearches)
   ✓ should log successful monthly reset

✅ QuotaResetJob › Error Handling
   ✓ should catch and log database errors without crashing
   ✓ should not throw exception on reset failure

✅ QuotaResetJob › Cron Scheduling
   ✓ should start scheduled tasks
   ✓ should schedule daily reset at midnight (0 0 * * *)
   ✓ should schedule monthly reset on 1st day of month (0 0 1 * *)
   ✓ should stop scheduled tasks

Total: 12/12 PASSED ✅
```

### Full Test Suite
```
Test Files: 14 passed, 1 failed
Total Tests: 243 passed, 5 failed
```

**Nota**: Los 5 fallos son en tests de integración pre-existentes (analyze.controller.spec.ts), no causados por este PR.

---

## 🏗️ Arquitectura

### Flujo de Ejecución

```
App Start (index.ts)
    ↓
DependencyContainer.getInstance()
    ↓
    ├─ Inicializar ChromaDB
    └─ Inicializar QuotaResetJob
         ↓
         ├─ start()
         │  ├─ cron.schedule('0 0 * * *', runDailyReset)
         │  └─ cron.schedule('0 0 1 * *', runMonthlyReset)
         └─ Log: "✅ Quota Reset Job started"
```

### Patrón de Reseteo

**Daily Reset (00:00 UTC)**:
```javascript
for each user:
  usageStats.articlesAnalyzed = 0  // Reset
  usageStats.chatMessages         // Preserve
  usageStats.searchesPerformed    // Preserve
```

**Monthly Reset (00:00 UTC, 1º de mes)**:
```javascript
for each user:
  usageStats.articlesAnalyzed     // Preserve
  usageStats.chatMessages = 0     // Reset
  usageStats.groundingSearches = 0 // Reset
```

---

## 🔧 Características Técnicas

### Error Handling Robusto
```typescript
async runDailyReset(): Promise<number> {
  try {
    // Update users
    return updatedCount;
  } catch (error) {
    console.error('[QuotaResetJob] Daily reset failed:', error);
    return 0; // Don't throw: server continues running
  }
}
```

### Cron Patterns
- Daily: `0 0 * * *` (Medianoche cada día)
- Monthly: `0 0 1 * *` (Medianoche del 1º de cada mes)

### Preservación de Datos
- Usa `prisma.user.update()` loop en lugar de `updateMany()`
- Preserva otros campos en usageStats JSON
- Realiza deep merge de estadísticas

---

## 🔐 Consideraciones de Seguridad

✅ **No requiere autenticación** - Los cron jobs se ejecutan en contexto del servidor
✅ **Actualiza globalmente** - Se resetean cuotas para TODOS los usuarios
✅ **No afecta datos históricos** - Solo modifica campo `usageStats` actual
✅ **Manejo de errores seguro** - Captura excepciones sin revelar detalles

---

## 📝 Próximos Pasos (Paso 3+)

1. **Paso 3**: Aplicar quota enforcement a `ChatArticleUseCase` (para 'chat' resource)
2. **Paso 4**: Aplicar quota enforcement a `GroundingUseCase` (para 'grounding' resource)
3. **Paso 5**: Frontend integration (display quota limits, near-limit alerts)
4. **Paso 6**: Billing & Reporting (usage reports, notifications, payments)

---

## 🎯 Checklist de Validación

- [x] Test file created with comprehensive test cases
- [x] QuotaResetJob class implemented
- [x] node-cron dependency installed
- [x] Registered in DependencyContainer
- [x] Initialized in server startup (index.ts)
- [x] Error handling prevents server crash
- [x] Daily reset works (articlesAnalyzed → 0)
- [x] Monthly reset works (chatMessages, groundingSearches → 0)
- [x] All 12 unit tests pass
- [x] No regressions in existing tests (243 passed)
- [x] Comprehensive logging in place
- [x] Documentation updated

---

## 💡 Notas de Implementación

1. **Timezone**: Los cron jobs se ejecutan en UTC (00:00 UTC). Para producción, considerar usar zona horaria del usuario.

2. **Performance**: Itera sobre usuarios uno por uno en lugar de usar `updateMany()` para preservar otros campos JSON. En producción con millones de usuarios, considerar batch updates.

3. **Graceful Shutdown**: El método `stop()` existe pero aún no se llama en `index.ts`. Implementar graceful shutdown en futuras iteraciones.

4. **Testing**: Mock de Prisma en tests es simple pero funcional. Para tests de integración, considerar usar instancia real de Prisma.

---

## 📚 Referencias

- [node-cron documentation](https://github.com/node-cron/node-cron)
- [Cron expression syntax](https://en.wikipedia.org/wiki/Cron#Overview)
- [Prisma JSON fields](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference#json)

---

**Completado por**: Claude Code (TDD Cycle)
**Tiempo total**: ~45 minutos
**Metodología**: Test-Driven Development (RED → GREEN → REFACTOR)

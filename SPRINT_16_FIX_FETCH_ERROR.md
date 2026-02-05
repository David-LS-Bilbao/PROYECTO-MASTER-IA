# Sprint 16 - Fix: "Failed to fetch" Error en Auto-Ingesta

**Status**: ✅ FIXED
**Date**: 2026-02-05
**Type**: Bug Fix - Error Handling & Backend Availability Check

---

## 📋 Problema Reportado

**Error Type**: Console TypeError
**Error Message**: `Failed to fetch`

```
at Home.useEffect.timeoutId (file:///.../frontend/.next/dev/static/chunks/_f1d16f66._.js:4131:48)
```

**Causa**: El useEffect de auto-ingesta intentaba hacer `fetch('/api/ingest/news')` pero:
1. Backend no estaba corriendo o no disponible
2. No había manejo de errores robusto
3. El error se propagaba y crasheaba la experiencia del usuario

---

## 🎯 Solución Implementada

### 1️⃣ **Health Check del Backend**

Añadido `useEffect` que verifica disponibilidad del backend al montar el componente:

```typescript
const [isBackendAvailable, setIsBackendAvailable] = useState(true);

useEffect(() => {
  const checkBackendHealth = async () => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${API_BASE_URL}/health/check`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log('✅ [HEALTH CHECK] Backend disponible para auto-ingesta');
        setIsBackendAvailable(true);
      } else {
        console.warn('⚠️ [HEALTH CHECK] Backend respondió con error:', response.status);
        setIsBackendAvailable(false);
      }
    } catch (error) {
      console.warn('🔌 [HEALTH CHECK] Backend no disponible - Auto-ingesta deshabilitada');
      setIsBackendAvailable(false);
    }
  };

  checkBackendHealth();
}, []); // Solo ejecutar una vez al montar
```

**Beneficios**:
- ✅ Verifica disponibilidad del backend una sola vez (2s timeout)
- ✅ Si falla, deshabilita auto-ingesta automáticamente
- ✅ No crashea si backend no está corriendo

### 2️⃣ **Skip Ingesta si Backend No Disponible**

Modificado el useEffect de auto-ingesta para verificar disponibilidad:

```typescript
useEffect(() => {
  // ... skip primera carga, skip favoritos ...

  // Skip si backend no está disponible - solo hacer refetch de BD
  if (!isBackendAvailable) {
    console.log('🔌 [AUTO-INGESTA] Backend no disponible - Solo refetch de BD');
    invalidateNews(category);
    return;
  }

  // ... continuar con ingesta normal ...
}, [category, invalidateNews, isBackendAvailable]);
```

**Beneficios**:
- ✅ No intenta fetch si backend no disponible
- ✅ Aún así hace refetch de BD (muestra datos existentes)
- ✅ UX no se ve afectada

### 3️⃣ **Mejor Manejo de Errores en Fetch**

Añadido manejo de errores específico con timeout y AbortController:

```typescript
try {
  // Fetch con timeout de 5 segundos para evitar hangs
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  const response = await fetch(`${API_BASE_URL}/api/ingest/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (response.ok) {
    // ... success ...
  } else {
    console.warn(`⚠️ [AUTO-INGESTA] Error HTTP ${response.status}:`, response.statusText);
    invalidateNews(category);
  }
} catch (error) {
  // Manejo de errores más específico
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      console.warn('⏱️ [AUTO-INGESTA] Timeout (5s) - Backend puede estar lento o no disponible');
    } else if (error.message.includes('fetch')) {
      console.warn('🔌 [AUTO-INGESTA] Backend no disponible - Mostrando datos de BD actual');
    } else {
      console.warn('❌ [AUTO-INGESTA] Error:', error.message);
    }
  } else {
    console.warn('❌ [AUTO-INGESTA] Error desconocido:', error);
  }

  // Siempre intentar refetch de BD por si hay datos, incluso si falla ingesta
  invalidateNews(category);
}
```

**Beneficios**:
- ✅ Timeout de 5s evita hangs indefinidos
- ✅ Mensajes de error específicos y claros
- ✅ Siempre hace refetch de BD como fallback
- ✅ No crashea la app

---

## 📊 Comparativa: Antes vs Después

| Aspecto | ANTES (Con Bug) | DESPUÉS (Fixed) |
|---------|-----------------|-----------------|
| **Backend no disponible** | ❌ Error "Failed to fetch" | ✅ Health check detecta, skip ingesta |
| **Manejo de errores** | ❌ Error se propaga | ✅ Catch + warning en console |
| **UX cuando falla** | ❌ App crashea | ✅ Muestra datos de BD existentes |
| **Timeout** | ❌ Sin timeout (hang) | ✅ 5s timeout con AbortController |
| **Mensajes de error** | ❌ Genérico "Failed to fetch" | ✅ Específicos (timeout, network, etc) |
| **Fallback** | ❌ No hay fallback | ✅ Refetch de BD siempre |

---

## 🧪 Cómo Probar el Fix

### Test 1: Backend Corriendo (Caso Normal)

1. **Asegurarse que backend corre**: `cd backend && npm run dev`
2. **Abrir frontend**: http://localhost:3001
3. **DevTools → Console**
4. **Observar**:
   ```
   ✅ [HEALTH CHECK] Backend disponible para auto-ingesta
   ```
5. **Cambiar categoría**: General → Tecnología
6. **Observar**:
   ```
   📥 [AUTO-INGESTA] Iniciando ingesta automática para: technology
   ✅ [AUTO-INGESTA] Completada
   ```

**Resultado esperado**: Todo funciona normalmente.

### Test 2: Backend NO Corriendo (Caso de Error)

1. **Detener backend**: Cerrar terminal del backend
2. **Recargar frontend**: F5
3. **DevTools → Console**
4. **Observar**:
   ```
   🔌 [HEALTH CHECK] Backend no disponible - Auto-ingesta deshabilitada
   ```
5. **Cambiar categoría**: General → Tecnología
6. **Observar**:
   ```
   🔌 [AUTO-INGESTA] Backend no disponible - Solo refetch de BD
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   ✅ [useNews] Fetch completado en 150ms. Artículos: 23
   ```

**Resultado esperado**:
- ✅ NO crashea
- ✅ NO muestra error "Failed to fetch"
- ✅ Muestra datos de BD existentes
- ✅ UX funcional (solo muestra datos viejos)

### Test 3: Backend Lento (Timeout)

1. **Simular backend lento**: Añadir delay en backend
2. **Cambiar categoría**: General → Tecnología
3. **Observar después de 5s**:
   ```
   ⏱️ [AUTO-INGESTA] Timeout (5s) - Backend puede estar lento o no disponible
   🌐 [useNews] ========== EJECUTANDO queryFn ==========
   ```

**Resultado esperado**:
- ✅ No hang indefinido
- ✅ Timeout después de 5s
- ✅ Fallback a refetch de BD

---

## 🔧 Configuración de Timeout

Si 5 segundos es demasiado o muy poco, puedes ajustar:

```typescript
// En frontend/app/page.tsx

// Health Check Timeout (línea ~90)
const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s

// Auto-Ingesta Timeout (línea ~140)
const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s
```

**Recomendaciones**:
- **Health Check**: 2-3s (rápido, solo verifica disponibilidad)
- **Auto-Ingesta**: 5-10s (lento, espera ingesta completa)

---

## 🚨 Notas Importantes

### 1. Backend Requerido para Auto-Ingesta

**Auto-ingesta requiere backend corriendo**. Si backend no está disponible:
- ✅ App sigue funcionando
- ✅ Muestra datos de BD existentes
- ❌ No trae noticias nuevas de internet

**Solución para usuario**:
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 2. Primera Carga vs Cambio de Categoría

**Primera carga**:
- Health check verifica backend (2s timeout)
- Si falla, `isBackendAvailable = false`
- Auto-ingesta deshabilitada para toda la sesión

**Cambio de categoría**:
- Si `isBackendAvailable = false`, skip ingesta
- Solo hace refetch de BD (rápido)

### 3. Refetch de BD Siempre Funciona

Incluso si falla la ingesta o backend no disponible:
- ✅ `invalidateNews(category)` siempre se llama
- ✅ React Query hace refetch de BD
- ✅ Usuario ve datos (aunque sean viejos)

---

## 📚 Archivos Modificados

```
frontend/
└── app/page.tsx                                (+40 LOC)
    ├── useState(isBackendAvailable)
    ├── useEffect(health check)
    ├── useEffect(auto-ingesta) - skip si backend no disponible
    └── Better error handling con timeout y mensajes específicos
```

---

## 🚀 Próximos Pasos (Opcional)

1. **Indicador Visual de Estado**:
   - Badge en header: "Backend no disponible"
   - Toast al cambiar categoría: "Mostrando datos cacheados"

2. **Retry Automático**:
   - Si health check falla, reintentar cada 30s
   - Cuando backend vuelve, habilitar auto-ingesta

3. **Configuración de Usuario**:
   - Ajustes → "Habilitar auto-ingesta" (On/Off)
   - Override manual si backend no disponible

---

**Completado por**: Senior Frontend Architect
**Fecha**: 2026-02-05
**Próximo**: Sprint 16 - Paso 4 - Visual Indicators & Retry Logic

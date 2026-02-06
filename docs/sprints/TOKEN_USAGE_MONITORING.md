# Monitorización de Uso de Tokens (Gemini API)

## Descripción

El sistema de Verity News ahora incluye un sistema de monitorización de tokens consumidos por la API de Gemini. Este sistema permite visualizar en tiempo real el consumo de tokens y el coste asociado.

## Endpoint

### GET /api/user/token-usage

**Autenticación requerida:** Sí (Bearer Token)

**Descripción:** Obtiene las estadísticas de uso de tokens de Gemini para la sesión actual del servidor.

**Headers:**
```
Authorization: Bearer <firebase-token>
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "session": {
      "analysis": {
        "count": 15,
        "promptTokens": 45000,
        "completionTokens": 12000,
        "totalTokens": 57000,
        "cost": 0.0071
      },
      "ragChat": {
        "count": 8,
        "promptTokens": 24000,
        "completionTokens": 6000,
        "totalTokens": 30000,
        "cost": 0.0036
      },
      "groundingChat": {
        "count": 3,
        "promptTokens": 9000,
        "completionTokens": 2000,
        "totalTokens": 11000,
        "cost": 0.0013
      },
      "total": {
        "operations": 26,
        "promptTokens": 78000,
        "completionTokens": 20000,
        "totalTokens": 98000,
        "cost": 0.0120
      },
      "sessionStart": "2025-01-30T14:32:15.123Z",
      "uptime": "2h 15m 30s"
    },
    "note": "Estas estadísticas corresponden a la sesión actual del servidor. Para estadísticas históricas por usuario, consulta usageStats en el perfil."
  }
}
```

## Tipos de Operaciones

### 1. Analysis (Análisis de Artículos)
- **Uso:** Análisis completo de artículos de noticias
- **Incluye:** Resumen, bias score, fact-checking, sentiment analysis
- **Coste aproximado:** ~0.0005€ por análisis

### 2. RAG Chat (Chat con Contexto)
- **Uso:** Conversaciones sobre artículos con contexto semántico
- **Incluye:** Búsqueda en ChromaDB + generación de respuesta
- **Coste aproximado:** ~0.0003€ por mensaje

### 3. Grounding Chat (Chat con Búsqueda)
- **Uso:** Conversaciones con Google Search como fuente
- **Incluye:** Búsqueda en tiempo real + generación de respuesta
- **Coste aproximado:** ~0.0004€ por mensaje

## Cálculo de Costes

El sistema utiliza los precios de Gemini 2.5 Flash:
- **Input tokens:** $0.075 por millón de tokens
- **Output tokens:** $0.30 por millón de tokens
- **Conversión:** 1 USD = 0.95 EUR

**Fórmula:**
```
costeEUR = (promptTokens * 0.075 + completionTokens * 0.30) / 1_000_000 * 0.95
```

## Visualización en UI

El componente `TokenUsageCard` muestra las estadísticas en la página de perfil del usuario:

### Sección de Totales
- Operaciones totales
- Tokens totales (input + output)
- Coste total en EUR

### Desglose por Operación
Para cada tipo de operación (si tiene actividad):
- Número de operaciones
- Tokens de input
- Tokens de output
- Coste parcial

### Metadatos de Sesión
- Fecha/hora de inicio de sesión
- Tiempo de actividad (uptime)

## Uso desde el Frontend

```typescript
import { getTokenUsage, TokenUsageStats } from '@/lib/api';

// Obtener token de Firebase Auth
const token = await getToken();

// Obtener estadísticas
const stats: TokenUsageStats = await getTokenUsage(token);

console.log(`Total gastado: €${stats.total.cost.toFixed(4)}`);
console.log(`Análisis realizados: ${stats.analysis.count}`);
```

## Limitaciones Actuales

1. **Estadísticas por sesión:** Los datos se reinician al reiniciar el servidor
2. **No por usuario:** Las estadísticas son globales del servidor, no por usuario individual
3. **Sin persistencia:** No se guardan en base de datos (solo en memoria)

## Mejoras Futuras

1. **Tracking por usuario:** Guardar el consumo en `User.usageStats`
2. **Persistencia:** Almacenar histórico en base de datos
3. **Alertas:** Notificar cuando se supera un umbral de coste
4. **Límites:** Implementar límites por plan (Free/Premium)
5. **Exportación:** Permitir exportar reportes en CSV/PDF

## Ejemplos de Uso

### Ver estadísticas en consola del backend
El sistema ya incluye logs automáticos en consola:
```
🧮 Taxímetro Gemini - Sesión actual
═══════════════════════════════════
📊 Análisis de artículos: 15 ops
   └─ Input: 45,000 | Output: 12,000 | Coste: €0.0071
💬 RAG Chat: 8 ops
   └─ Input: 24,000 | Output: 6,000 | Coste: €0.0036
🔍 Grounding Chat: 3 ops
   └─ Input: 9,000 | Output: 2,000 | Coste: €0.0013
───────────────────────────────────
💰 TOTAL: 26 ops | 98,000 tokens | €0.0120
═══════════════════════════════════
```

### Consultar endpoint manualmente (con curl)
```bash
# Obtener token de Firebase (reemplazar <firebase-token>)
curl -X GET http://localhost:3000/api/user/token-usage \
  -H "Authorization: Bearer <firebase-token>"
```

### Ver en UI
1. Iniciar sesión en Verity News
2. Navegar a `/profile`
3. Desplazarse hasta la tarjeta "Uso de Tokens (Gemini API)"

## Notas Técnicas

- El tracking se implementa en `backend/src/infrastructure/external/gemini.client.ts`
- Las estadísticas se acumulan en `sessionCosts` (objeto en memoria)
- El método `getSessionCostReport()` formatea los datos para la API
- El componente `TokenUsageCard` renderiza las estadísticas en React

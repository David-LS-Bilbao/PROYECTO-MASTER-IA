# REFACTORIZACIÓN - RSS DIRECTOS (Sprint 3 Final)

## 🎯 PROBLEMA IDENTIFICADO

Google News RSS usa **URLs obfuscadas** con redirecciones JavaScript que bloquean la extracción de metadata con Axios:

```
https://news.google.com/rss/articles/CBMi...redirect.goog
```

Estas URLs intermedias no permiten a `MetadataExtractor` acceder a las páginas originales de los medios (El País, El Mundo, etc.) para extraer `og:image`.

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Nuevo Cliente: `DirectSpanishRssClient`

Archivo: `src/infrastructure/external/direct-spanish-rss.client.ts`

**Características:**
- Consume feeds RSS directos de 4 medios españoles principales
- URLs limpias sin redirecciones
- Agregación multi-fuente con `Promise.allSettled`
- Ordenación por fecha (más recientes primero)
- Manejo robusto de errores (continúa si 1-2 feeds fallan)

**Fuentes configuradas:**
```typescript
const SPANISH_RSS_FEEDS = [
  {
    name: 'El País',
    url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada',
    id: 'elpais',
  },
  {
    name: 'El Mundo',
    url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml',
    id: 'elmundo',
  },
  {
    name: '20 Minutos',
    url: 'https://www.20minutos.es/rss/',
    id: '20minutos',
  },
  {
    name: 'Europa Press',
    url: 'https://www.europapress.es/rss/rss.aspx',
    id: 'europapress',
  },
];
```

**Lógica de agregación:**
- Fetches paralelos de 3 fuentes (configurable con `maxFeedsToFetch`)
- Merge de todos los artículos
- Ordenación descendente por `publishedAt`
- Aplicación de `pageSize` al resultado final

### 2. Integración en DependencyContainer

Archivo: `src/infrastructure/config/dependencies.ts`

**Cambios:**
```typescript
// Import
import { DirectSpanishRssClient } from '../external/direct-spanish-rss.client';

// Lógica de selección
const newsAPIClient =
  process.env.NEWS_CLIENT === 'newsapi'
    ? new NewsAPIClient()
    : process.env.NEWS_CLIENT === 'google-news'
    ? new GoogleNewsRssClient()
    : new DirectSpanishRssClient(); // Default: Direct Spanish RSS
```

**Opciones de configuración (.env):**
- Sin `NEWS_CLIENT` → **DirectSpanishRssClient** (nuevo default)
- `NEWS_CLIENT=google-news` → GoogleNewsRssClient (antiguo)
- `NEWS_CLIENT=newsapi` → NewsAPIClient (API de pago)

### 3. Extracción de Imágenes Mejorada

El nuevo cliente intenta extraer `urlToImage` del propio RSS:

```typescript
// Intenta 3 fuentes:
1. item.enclosure.url (RSS 2.0 estándar)
2. media:content (MRSS - Media RSS)
3. media:thumbnail (MRSS - alternativo)
```

Si el RSS no incluye imagen → `urlToImage: null` → **MetadataExtractor se ejecuta** durante el análisis con URLs limpias.

## 📊 BENEFICIOS

### Antes (Google News RSS):
```
URL noticia: https://news.google.com/rss/articles/CBMi...redirect.goog
└─> Redirección JS → MetadataExtractor falla
└─> Resultado: urlToImage = placeholder genérico
```

### Después (RSS Directos):
```
URL noticia: https://elpais.com/espana/2026-01-29/...
└─> URL directa → MetadataExtractor accede sin problemas
└─> Extrae og:image real del medio
└─> Resultado: urlToImage = imagen portada real del periódico
```

## 🔧 ESTADO ACTUAL

### ✅ Completado:
1. **DirectSpanishRssClient** implementado (280 líneas)
2. **DependencyContainer** actualizado con lógica condicional
3. **Backend compilado** exitosamente (`npm run build` ✅)
4. **MetadataExtractor** mejorado (`maxRedirects: 5` para seguir redirecciones CORS)

### ⚠️ Pendiente de validación:
- Probar ingesta con nuevo cliente (`POST /api/ingest/news`)
- Verificar que URLs de artículos son limpias
- Confirmar extracción de `og:image` durante análisis
- Validar Dashboard con imágenes reales (no placeholders)

## 🐛 PROBLEMAS DETECTADOS

El backend tiene problemas de conectividad en PowerShell al intentar ejecutar peticiones HTTP. Las llamadas a `/api/ingest/news` se quedan colgadas sin responder.

**Posibles causas:**
1. Timeout de RSS feeds (demasiado largos)
2. Problema de red/firewall
3. Error silencioso en el cliente RSS

## 🧪 VALIDACIÓN MANUAL RECOMENDADA

### Opción 1: Postman/Bruno

```
POST http://localhost:3000/api/ingest/news
Content-Type: application/json

{
  "query": "España",
  "pageSize": 10
}
```

**Verifica en respuesta:**
```json
{
  "data": {
    "saved": 10,
    "articles": [
      {
        "title": "...",
        "url": "https://elpais.com/...", // ✅ URL limpia
        "source": {
          "name": "El País" // ✅ Fuente directa
        }
      }
    ]
  }
}
```

### Opción 2: cURL

```bash
curl -X POST http://localhost:3000/api/ingest/news \
  -H "Content-Type: application/json" \
  -d '{"query":"España","pageSize":10}'
```

### Opción 3: Navegador (DevTools Console)

```javascript
fetch('http://localhost:3000/api/ingest/news', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'España', pageSize: 10 })
})
.then(r => r.json())
.then(data => console.log(data));
```

## 🎯 PRÓXIMOS PASOS

1. **Validar ingesta manual** con uno de los métodos anteriores
2. **Verificar URLs limpias** en la respuesta
3. **Ejecutar análisis batch** de las 85 noticias reseteadas
4. **Confirmar imágenes reales** en Dashboard (no logos "GE" de Google News)
5. **Medir mejora**: % noticias con `og:image` real vs placeholder

## 📈 MÉTRICAS OBJETIVO

**Antes de la refactorización:**
- Noticias con imagen real: ~0% (Google News redirige, MetadataExtractor falla)
- Placeholders Unsplash: 100%

**Después de la refactorización (esperado):**
- Noticias con imagen real: **>80%** (El País, El Mundo proporcionan og:image)
- Placeholders: <20% (solo para fuentes sin og:image)

---

**Autor:** Senior Backend Developer  
**Sprint:** 3 - Extracción de Imágenes Reales  
**Fecha:** 29 Enero 2026

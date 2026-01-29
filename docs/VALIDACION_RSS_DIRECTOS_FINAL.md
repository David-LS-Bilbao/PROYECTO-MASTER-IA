# VALIDACIÓN FINAL - RSS DIRECTOS (Sprint 3)

## 🎯 ESTADO ACTUAL

- ✅ `DirectSpanishRssClient` implementado y compilado
- ✅ Backend corriendo en `http://localhost:3000`
- ✅ Frontend corriendo en `http://localhost:3001`
- ✅ Base de datos limpia (90 noticias antiguas eliminadas)

## 🧪 VALIDACIÓN DESDE EL NAVEGADOR

### PASO 1: Ingestar Noticias con RSS Directos

Abre las **DevTools del navegador** (F12) y ejecuta en la **Console**:

```javascript
fetch('http://localhost:3000/api/ingest/news', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'actualidad', pageSize: 20 })
})
.then(r => r.json())
.then(data => {
  console.log(`✅ Guardadas: ${data.data.saved} noticias`);
  console.log('\n📊 Primeras 3 noticias:');
  data.data.articles.slice(0, 3).forEach((art, i) => {
    console.log(`\n${i+1}. ${art.title}`);
    console.log(`   Source: ${art.source.name}`);
    console.log(`   URL: ${art.url}`);
    console.log(`   Image: ${art.urlToImage || 'NULL - será extraída por MetadataExtractor'}`);
  });
})
.catch(err => console.error('❌ Error:', err));
```

**Verifica en la consola:**
- ✅ `Source`: "El País", "El Mundo", "20 Minutos" (NO "Google News")
- ✅ `URL`: URLs limpias como `https://elpais.com/...` (NO `news.google.com/rss/articles/CBMi...`)

### PASO 2: Analizar las Noticias (Extracción de Imágenes)

Una vez ingresadas las 20 noticias, ejecuta el análisis:

```javascript
fetch('http://localhost:3000/api/analyze/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ limit: 20 })
})
.then(r => r.json())
.then(data => {
  console.log(`✅ Analizadas: ${data.data.successful} exitosas`);
  console.log(`❌ Fallidas: ${data.data.failed}`);
})
.catch(err => console.error('❌ Error:', err));
```

**Espera:** 2-3 minutos (depende de Gemini API y MetadataExtractor)

### PASO 3: Verificar Dashboard

1. Recarga el **Dashboard** (F5 en `http://localhost:3001`)
2. Verifica las imágenes de las tarjetas de noticias

**✅ ÉXITO SI:**
- Ves **imágenes reales** de portadas de periódicos (El País, El Mundo, etc.)
- **NO** ves logos genéricos "GE" de Google News

**❌ PROBLEMA SI:**
- Siguen apareciendo logos "GE" → Verificar logs del backend para errores de MetadataExtractor

### PASO 4: Verificar Logs del Backend

En el terminal del backend, busca mensajes como:

```
[DirectSpanishRssClient] Fetching from 3 Spanish media outlets...
[DirectSpanishRssClient] ✅ El País: 15 articles
[DirectSpanishRssClient] ✅ El Mundo: 12 articles
[DirectSpanishRssClient] ✅ 20 Minutos: 18 articles
[DirectSpanishRssClient] 📊 Total: 20 articles from 3/3 sources

🖼️ Extrayendo metadata de imagen (timeout 2s)...
✅ Imagen encontrada: https://estaticos.elpais.com/...
```

## 📊 MÉTRICAS ESPERADAS

**Antes (Google News RSS):**
- Noticias con imagen real: 0%
- Placeholders genéricos: 100%

**Después (RSS Directos):**
- Noticias con imagen real: **>80%**
- Placeholders: <20%

## 🐛 TROUBLESHOOTING

### Si las URLs siguen siendo de Google News:

Verifica que el `.env` **NO** tiene `NEWS_CLIENT=google-news`. Debería estar vacío o sin esa variable (por defecto usa DirectSpanishRssClient).

### Si MetadataExtractor falla:

Verifica los logs del backend. Puede haber problemas de:
- CORS del medio (algunos bloquean bots)
- Timeout (aumentar de 2s a 5s en `metadata-extractor.ts`)
- Estructura HTML diferente (algunos medios no usan og:image)

### Si las imágenes del RSS son suficientes:

Algunos feeds RSS (El País MRSS) ya incluyen imágenes. En ese caso, `urlToImage` se poblará directamente del RSS y MetadataExtractor no se ejecutará.

## 🎯 RESULTADO FINAL ESPERADO

Dashboard mostrando noticias como:

```
┌─────────────────────────────────────┐
│ [Imagen portada El País]            │
│ El País • Hace 2 horas              │
│ CSIF denuncia crisis asistencial... │
│ Análisis IA: Sesgo moderado (55%)   │
└─────────────────────────────────────┘
```

En lugar de:

```
┌─────────────────────────────────────┐
│ [Logo genérico "GE"]                │
│ Google News • Hace 2 horas          │
│ CSIF denuncia crisis asistencial... │
│ Análisis IA: Sesgo moderado (55%)   │
└─────────────────────────────────────┘
```

---

**Última actualización:** 29 Enero 2026  
**Estado:** ✅ Código implementado, pendiente validación manual

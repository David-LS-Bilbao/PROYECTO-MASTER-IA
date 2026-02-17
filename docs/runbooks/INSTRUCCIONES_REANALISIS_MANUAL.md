# INSTRUCCIONES - RE-ANÁLISIS MANUAL BATCH

## ✅ COMPLETADO

1. **Limpieza BD**: 85 noticias reseteadas (solo 5 conservan análisis)
2. **MetadataExtractor mejorado**: `maxRedirects: 5` compilado

## ⚠️ PROBLEMA TÉCNICO

El backend tiene problemas de conectividad en PowerShell. Las peticiones HTTP se cuelgan.

## 🔧 SOLUCIÓN: EJECUCIÓN MANUAL

### OPCIÓN 1: Usar script Node.js (RECOMENDADO)

```bash
# Terminal 1: Iniciar backend
cd backend
npm run dev

# Terminal 2: Ejecutar script batch
node scripts/run-batch-analysis.js
```

### OPCIÓN 2: Usar Postman / Bruno / Insomnia

1. Iniciar backend: `cd backend && npm run dev`
2. Crear petición POST a `http://localhost:3000/api/analyze/batch`
3. Body (JSON):
   ```json
   {
     "limit": 10
   }
   ```
4. Ejecutar 9 veces (8x10 + 1x5 = 85 noticias)

### OPCIÓN 3: Navegador (más lento pero funcional)

1. Abrir DevTools Console (F12)
2. Ejecutar:
   ```javascript
   async function runBatches() {
     for (let i = 0; i < 8; i++) {
       const res = await fetch('http://localhost:3000/api/analyze/batch', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ limit: 10 })
       });
       const data = await res.json();
       console.log(`Batch ${i+1}/9:`, data);
       await new Promise(r => setTimeout(r, 2000));
     }
     // Último batch de 5
     const res = await fetch('http://localhost:3000/api/analyze/batch', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ limit: 5 })
     });
     const data = await res.json();
     console.log('Batch 9/9:', data);
   }
   runBatches();
   ```

## 🎯 VERIFICACIÓN FINAL

Una vez completados los 85 análisis:

```bash
# Ver estadísticas
curl http://localhost:3000/api/analyze/stats

# Ver últimas 20 noticias
curl "http://localhost:3000/api/analyze/stats"
```

**Resultado esperado:**
- `analyzedAt`: NOT NULL
- `urlToImage`: URLs de medios reales (El País, El Mundo, etc.)
- **NO** `lh3.googleusercontent.com` (logos genéricos Google News)
- **NO** `unsplash.com` (placeholders)

## 📋 LOGS A MONITORIZAR

Durante el análisis, verifica en consola del backend:

```
🖼️ Extrayendo metadata de imagen (timeout 2s)...
✅ Imagen encontrada: https://estaticos.elpais.com/...
```

O en caso de fallo:

```
⚠️ No se encontró og:image, usando placeholder
```

## 🐛 DEBUGGING

Si después de los 85 análisis siguen apareciendo imágenes genéricas:

1. Verifica logs: ¿Se ejecutó MetadataExtractor?
2. Verifica redirecciones: URLs Google News deben redirigir a medios originales
3. Revisa errores en consola del backend

---

**Estado actual:** Backend compilado con mejoras, BD limpia, script listo. Pendiente ejecución manual de batches.

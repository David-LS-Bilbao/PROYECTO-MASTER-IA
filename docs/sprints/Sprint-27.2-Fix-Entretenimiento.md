# Sprint 27.2: Fix Entretenimiento y Calidad de Ingesta

**Fecha:** 2026-02-10  
**Estado:** ✅ Completado  
**Objetivo:** Garantizar contenido real de entretenimiento y evitar fallback a "general".

---

## ✅ Cambios Técnicos

- **DirectSpanishRssClient**
- Alias `entretenimiento` / `entertainment` → `cultura`.
- Keywords ampliadas: `series`, `videojuegos`, `espectáculos`.

- **GoogleNewsRssClient**
- Query automática por categoría cuando no hay `query`.
- `entretenimiento` fuerza: `cine OR series OR musica OR videojuegos OR espectaculos`.

- **NewsAPI**
- Mapeo de categoría `entretenimiento` → `entertainment` (NewsAPI estándar).

---

## 🧪 Tests Ejecutados

```
npx vitest run tests/infrastructure/external/direct-spanish-rss.client.spec.ts \
  tests/infrastructure/external/google-news-rss.client.spec.ts
```

---

## 📁 Archivos Clave

- `backend/src/infrastructure/external/direct-spanish-rss.client.ts`
- `backend/src/infrastructure/external/google-news-rss.client.ts`
- `backend/src/infrastructure/external/newsapi.client.ts`
- `backend/tests/infrastructure/external/direct-spanish-rss.client.spec.ts`
- `backend/tests/infrastructure/external/google-news-rss.client.spec.ts`

---

**Estado:** ✅ Categoría entretenimiento consistente en todos los clientes.

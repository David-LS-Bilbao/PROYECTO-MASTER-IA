# 🔄 Guía de Migración: useEffect → React Query

## Ejemplo de Refactorización en `app/page.tsx`

### ❌ ANTES (useEffect manual)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { fetchNews, fetchDashboardStats, type NewsArticle } from '@/lib/api';

export default function Home() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ❌ PROBLEMA: Gestión manual de estados async
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        const newsResponse = await fetchNews(50, 0);
        setNews(newsResponse.data);

        const statsResponse = await fetchDashboardStats();
        setStats(statsResponse);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []); // ❌ Sin reintentos automáticos, sin caché

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {news.map(article => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
```

### ✅ DESPUÉS (React Query)

```tsx
'use client';

import { useNews } from '@/hooks/useNews';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { NewsCard } from '@/components/news-card';

export default function Home() {
  // ✅ SOLUCIÓN: Hooks especializados con caché y reintentos
  const { data: newsData, isLoading: newsLoading, error: newsError } = useNews({
    category: 'general',
    limit: 50,
    offset: 0,
  });

  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const isLoading = newsLoading || statsLoading;
  const news = newsData?.data || [];

  if (isLoading) return <div>Cargando...</div>;
  if (newsError) return <div>Error: {newsError.message}</div>;

  return (
    <div>
      {news.map(article => (
        <NewsCard key={article.id} article={article} />
      ))}
    </div>
  );
}
```

## 📊 Beneficios de la Migración

| Aspecto | useEffect Manual | React Query |
|---------|------------------|-------------|
| **Código** | ~30 líneas | ~10 líneas |
| **Caché** | ❌ Sin caché | ✅ 60s staleTime |
| **Reintentos** | ❌ Manual | ✅ 3 automáticos |
| **Loading** | ❌ Gestión manual | ✅ Automático |
| **Error** | ❌ Gestión manual | ✅ Automático |
| **Refetch** | ❌ Manual | ✅ Automático |
| **DevTools** | ❌ Sin debugging | ✅ React Query DevTools |
| **Prefetch** | ❌ No soportado | ✅ Automático |
| **Optimistic UI** | ❌ Manual | ✅ Automático |

## 🔄 Migración Paso a Paso

### 1. Identificar Fetchers

```tsx
// ❌ ANTES
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function load() {
    setLoading(true);
    const res = await fetchNews();
    setData(res);
    setLoading(false);
  }
  load();
}, []);
```

### 2. Reemplazar por Hook

```tsx
// ✅ DESPUÉS
const { data, isLoading } = useNews();
```

### 3. Actualizar Renders

```tsx
// ❌ ANTES
if (loading) return <Spinner />;
return <div>{data?.map(...)}</div>;

// ✅ DESPUÉS (mismo código)
if (isLoading) return <Spinner />;
return <div>{data?.data?.map(...)}</div>;
```

## 🎯 Casos de Uso Específicos

### Paginación con Cache

```tsx
const [page, setPage] = useState(0);

const { data, isLoading, isFetching } = useNews({
  category: 'general',
  limit: 20,
  offset: page * 20,
});

// ✅ isFetching: true durante refetch (cambio de página)
// ✅ isLoading: true solo en carga inicial
// ✅ placeholderData: mantiene datos previos (sin parpadeo)
```

### Filtrado Reactivo

```tsx
const [category, setCategory] = useState('general');

const { data } = useNews({ category });

// ✅ Cambiar category → refetch automático
// ✅ Caché por categoría (navegar rápido sin refetch)
```

### Invalidación Después de Mutación

```tsx
import { useInvalidateNews } from '@/hooks/useNews';

function FavoriteButton({ articleId }) {
  const invalidateNews = useInvalidateNews();

  const handleToggleFavorite = async () => {
    await toggleFavorite(articleId);
    
    // ✅ Refetch automático de todas las noticias
    invalidateNews();
    
    // O solo la categoría de favoritos:
    // invalidateNews('favorites');
  };
}
```

## 📦 Dependencias Instaladas

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

## ✅ Checklist de Migración

- [x] Instalar dependencias (`@tanstack/react-query`)
- [x] Crear `QueryProvider` (`components/providers/query-provider.tsx`)
- [x] Envolver app en `layout.tsx`
- [x] Crear hooks especializados (`useNews`, `useDashboardStats`)
- [x] Habilitar DevTools (solo desarrollo)
- [ ] Migrar `page.tsx` (reemplazar useEffect)
- [ ] Migrar componentes hijos (NewsCard, Dashboard)
- [ ] Añadir prefetching para UX optimizada
- [ ] Configurar optimistic updates para mutaciones

## 🚀 Próximos Pasos

1. **Migrar `page.tsx`**: Reemplazar useEffect por `useNews()`
2. **Migrar Dashboard**: Usar `useDashboardStats()`
3. **Añadir Mutaciones**: `useMutation` para favoritos, análisis
4. **Optimistic UI**: Actualizar UI antes de confirmar en backend
5. **Prefetching**: Precargar siguiente página mientras usuario navega

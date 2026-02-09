# Sprint 19.5 - Mantenimiento de Datos y Mejoras de UX

## Objetivo
Implementar limpieza automática de artículos antiguos y mejorar la experiencia de usuario con separadores de fecha en la lista de noticias.

---

## TAREA 1: Limpieza Automática de Artículos (Backend)

### Problema
Con el tiempo, la base de datos acumula artículos antiguos que ocupan espacio y no son relevantes para los usuarios. Sin embargo, no podemos eliminar artículos que los usuarios han marcado como favoritos.

### Solución: Cron Job con node-cron

#### 1. Instalación de Dependencias

```bash
cd backend
npm install node-cron @types/node-cron --save-dev
```

#### 2. Implementación del Job

**Archivo**: `backend/src/infrastructure/jobs/cleanup-news.job.ts`

```typescript
import cron, { ScheduledTask } from 'node-cron';
import { PrismaClient } from '@prisma/client';

export class CleanupNewsJob {
  private cleanupTask?: ScheduledTask;
  private readonly RETENTION_DAYS = 30;

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Deletes articles older than RETENTION_DAYS that are NOT favorited
   * Called daily at 2:00 AM (0 2 * * *)
   */
  async runCleanup(): Promise<{ deletedCount: number; preservedCount: number }> {
    try {
      // 1️⃣ Calcular fecha de corte (30 días atrás)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.RETENTION_DAYS);

      console.log(`🧹 Starting News Cleanup Job...`);
      console.log(`📅 Cutoff Date: ${cutoffDate.toISOString()}`);

      // 2️⃣ Buscar artículos antiguos
      const oldArticles = await this.prisma.article.findMany({
        where: {
          publishedAt: { lt: cutoffDate },
        },
        select: { id: true, title: true, publishedAt: true },
      });

      console.log(`📊 Found ${oldArticles.length} old articles`);

      if (oldArticles.length === 0) {
        return { deletedCount: 0, preservedCount: 0 };
      }

      // 3️⃣ Obtener IDs de artículos favoritos (deben preservarse)
      const favoritedArticleIds = await this.prisma.favorite.findMany({
        where: {
          articleId: { in: oldArticles.map(a => a.id) },
        },
        select: { articleId: true },
        distinct: ['articleId'],
      });

      const favoritedIds = new Set(favoritedArticleIds.map(f => f.articleId));

      console.log(`❤️  Preserving ${favoritedIds.size} favorited articles`);

      // 4️⃣ Separar artículos en eliminables y preservados
      const articlesToDele = oldArticles.filter(a => !favoritedIds.has(a.id));

      console.log(`🗑️  Deleting ${articlesToDele.length} non-favorited articles`);

      // 5️⃣ Eliminar artículos no favoritos
      if (articlesToDele.length > 0) {
        const deleteResult = await this.prisma.article.deleteMany({
          where: {
            id: { in: articlesToDele.map(a => a.id) },
          },
        });

        console.log(`✅ Successfully deleted ${deleteResult.count} articles`);
      }

      return {
        deletedCount: articlesToDele.length,
        preservedCount: favoritedIds.size,
      };
    } catch (error) {
      console.error('[CleanupNewsJob] Cleanup failed:', error);
      return { deletedCount: 0, preservedCount: 0 };
    }
  }

  /**
   * Starts the cron job
   * Runs daily at 2:00 AM UTC (0 2 * * *)
   */
  start(): void {
    try {
      // 📅 Programar limpieza diaria a las 2:00 AM (horario de bajo tráfico)
      this.cleanupTask = cron.schedule('0 2 * * *', async () => {
        await this.runCleanup();
      });

      console.log('✅ News Cleanup Job started');
      console.log('   🗑️  Daily cleanup: Every day at 02:00 (UTC)');
      console.log(`   📅 Retention period: ${this.RETENTION_DAYS} days`);
    } catch (error) {
      console.error('[CleanupNewsJob] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stops the cron job
   */
  stop(): void {
    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask.destroy();
    }
    console.log('⏹️  News Cleanup Job stopped');
  }

  /**
   * Manual cleanup trigger (for testing or admin endpoints)
   */
  async manualCleanup(): Promise<{ deletedCount: number; preservedCount: number }> {
    console.log('🔧 Manual cleanup triggered');
    return this.runCleanup();
  }
}
```

#### 3. Registro en Dependency Container

**Archivo**: `backend/src/infrastructure/config/dependencies.ts`

```typescript
import { CleanupNewsJob } from '../jobs/cleanup-news.job';

export class DependencyContainer {
  // ... existing properties
  public readonly cleanupNewsJob: CleanupNewsJob;

  private constructor() {
    // ... existing initialization

    // News Cleanup Job (Sprint 19.5 - Tarea 1)
    this.cleanupNewsJob = new CleanupNewsJob(this.prisma);
  }
}
```

#### 4. Iniciar Job en Servidor

**Archivo**: `backend/src/index.ts`

```typescript
// Start News Cleanup Job (Sprint 19.5 - Tarea 1: Limpieza Automática)
try {
  container.cleanupNewsJob.start();
} catch (error) {
  console.error('❌ Failed to start News Cleanup Job:', error);
  // Don't crash the server: cleanup can still work manually
}
```

#### 5. Verificación en Logs

Al iniciar el backend, deberías ver:

```
✅ News Cleanup Job started
   🗑️  Daily cleanup: Every day at 02:00 (UTC)
   📅 Retention period: 30 days
```

### Reglas de Negocio

1. ✅ **Retención**: 30 días desde `publishedAt`
2. ✅ **Preservación**: Artículos en tabla `Favorite` NUNCA se eliminan
3. ✅ **Horario**: 2:00 AM UTC (horario de bajo tráfico)
4. ✅ **Logs Detallados**: Muestra cantidad de artículos eliminados vs. preservados

### Testing Manual

Para probar el job manualmente sin esperar a las 2:00 AM:

```typescript
// En una consola Node.js o endpoint de prueba
const container = DependencyContainer.getInstance();
const result = await container.cleanupNewsJob.manualCleanup();
console.log(result); // { deletedCount: X, preservedCount: Y }
```

---

## TAREA 2: Separadores de Fecha (Frontend)

### Problema
En la lista de infinite scroll, todos los artículos aparecen mezclados sin contexto temporal. Es difícil saber si estás viendo noticias de hoy, ayer o de hace varios días.

### Solución: Agrupación por Fecha con Separadores Visuales

#### 1. Helpers de Formato de Fecha

**Archivo**: `frontend/lib/date-utils.ts` (NUEVO)

```typescript
import type { NewsArticle } from './api';

export interface DateGroup {
  label: string;
  date: string; // YYYY-MM-DD format for grouping
  articles: NewsArticle[];
}

/**
 * Formatea una fecha relativa (Hoy, Ayer, o fecha absoluta)
 *
 * @example
 * formatRelativeDate('2024-02-06T10:00:00Z') // "Hoy, 6 de febrero"
 * formatRelativeDate('2024-02-05T10:00:00Z') // "Ayer, 5 de febrero"
 * formatRelativeDate('2024-02-04T10:00:00Z') // "Domingo, 4 de febrero"
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Normalize dates to midnight for comparison
  const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const normalizedDate = normalizeDate(date);
  const normalizedToday = normalizeDate(today);
  const normalizedYesterday = normalizeDate(yesterday);

  const daysDiff = Math.floor((normalizedToday.getTime() - normalizedDate.getTime()) / (1000 * 60 * 60 * 24));

  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const formattedDate = formatter.format(date);

  if (normalizedDate.getTime() === normalizedToday.getTime()) {
    return `Hoy, ${formattedDate.split(', ')[1]}`; // "Hoy, 6 de febrero"
  } else if (normalizedDate.getTime() === normalizedYesterday.getTime()) {
    return `Ayer, ${formattedDate.split(', ')[1]}`; // "Ayer, 5 de febrero"
  } else if (daysDiff < 7) {
    const capitalized = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    return capitalized; // "Domingo, 4 de febrero"
  } else {
    const dateOnlyFormatter = new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return dateOnlyFormatter.format(date); // "15 de enero de 2024"
  }
}

/**
 * Agrupa artículos por fecha de publicación
 *
 * @example
 * groupArticlesByDate(articles) // [
 *   { label: "Hoy, 6 de febrero", date: "2024-02-06", articles: [...] },
 *   { label: "Ayer, 5 de febrero", date: "2024-02-05", articles: [...] }
 * ]
 */
export function groupArticlesByDate(articles: NewsArticle[]): DateGroup[] {
  // Group by date (YYYY-MM-DD)
  const grouped = new Map<string, NewsArticle[]>();

  for (const article of articles) {
    const date = new Date(article.publishedAt);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }

    grouped.get(dateKey)!.push(article);
  }

  // Convert to array and format labels
  const groups: DateGroup[] = [];

  for (const [dateKey, groupArticles] of grouped.entries()) {
    const label = formatRelativeDate(groupArticles[0].publishedAt);

    groups.push({
      label,
      date: dateKey,
      articles: groupArticles,
    });
  }

  // Sort by date descending (most recent first)
  groups.sort((a, b) => b.date.localeCompare(a.date));

  return groups;
}
```

#### 2. Componente DateSeparator

**Archivo**: `frontend/components/date-separator.tsx` (NUEVO)

```typescript
interface DateSeparatorProps {
  label: string;
  articleCount?: number;
}

export function DateSeparator({ label, articleCount }: DateSeparatorProps) {
  return (
    <div className="col-span-full max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-4 my-8">
        {/* Left Line */}
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-zinc-300 dark:to-zinc-700"></div>

        {/* Date Label */}
        <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full shadow-sm">
          {/* Calendar Icon */}
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>

          <span className="text-sm font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
            {label}
          </span>

          {articleCount !== undefined && (
            <span className="text-xs text-muted-foreground bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {articleCount} {articleCount === 1 ? 'noticia' : 'noticias'}
            </span>
          )}
        </div>

        {/* Right Line */}
        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-zinc-300 dark:via-zinc-700 to-zinc-300 dark:to-zinc-700"></div>
      </div>
    </div>
  );
}
```

#### 3. Integración en Dashboard

**Archivo**: `frontend/app/page.tsx`

**Imports**:
```typescript
import { DateSeparator } from '@/components/date-separator';
import { groupArticlesByDate } from '@/lib/date-utils';
```

**Renderizado**:
```typescript
{/* Sprint 19.5: Date Separators + Grouped News Grid */}
<div className="max-w-7xl mx-auto">
  {groupArticlesByDate(newsData.data).map((group, groupIndex) => (
    <div key={group.date}>
      {/* Date Separator */}
      <DateSeparator label={group.label} articleCount={group.articles.length} />

      {/* Articles Grid for this date */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {group.articles.map((article: NewsArticle) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>
    </div>
  ))}
</div>
```

### Diseño Visual

El separador de fecha tiene:

- ✅ **Líneas decorativas** con gradiente a los lados
- ✅ **Icono de calendario** para contexto visual
- ✅ **Etiqueta de fecha** formateada ("Hoy", "Ayer", etc.)
- ✅ **Badge de cantidad** de artículos en ese grupo
- ✅ **Responsive**: Se adapta a diferentes tamaños de pantalla
- ✅ **Dark mode**: Estilos específicos para tema oscuro

### Ejemplos de Etiquetas

```
Hoy, 6 de febrero       (si es hoy)
Ayer, 5 de febrero      (si fue ayer)
Domingo, 4 de febrero   (si fue esta semana)
15 de enero de 2024     (si es más antiguo)
```

---

## Testing de Integración

### 1. Verificar Cron Job

1. Iniciar backend: `npm start`
2. Verificar log:
   ```
   ✅ News Cleanup Job started
      🗑️  Daily cleanup: Every day at 02:00 (UTC)
      📅 Retention period: 30 days
   ```

### 2. Verificar Separadores de Fecha

1. Iniciar frontend: `npm run dev`
2. Navegar a [http://localhost:3001](http://localhost:3001)
3. Hacer scroll en la lista de noticias
4. Observar separadores de fecha agrupando artículos

**Ejemplo visual esperado**:

```
━━━━━━━━━  📅 Hoy, 6 de febrero (15 noticias)  ━━━━━━━━━

[NewsCard] [NewsCard] [NewsCard]
[NewsCard] [NewsCard] [NewsCard]

━━━━━━━  📅 Ayer, 5 de febrero (12 noticias)  ━━━━━━━

[NewsCard] [NewsCard] [NewsCard]
[NewsCard] [NewsCard]

━━━━━  📅 Domingo, 4 de febrero (8 noticias)  ━━━━━

[NewsCard] [NewsCard] [NewsCard]
```

---

## Mejoras de UX Implementadas

### TAREA 1 (Backend)
- ✅ **Auto-limpieza**: La BD no crece indefinidamente
- ✅ **Preservación inteligente**: Favoritos nunca se eliminan
- ✅ **Bajo impacto**: Se ejecuta a las 2:00 AM (poco tráfico)
- ✅ **Logs detallados**: Fácil monitoreo y debugging

### TAREA 2 (Frontend)
- ✅ **Contexto temporal**: Usuario sabe cuándo se publicó cada grupo
- ✅ **Navegación intuitiva**: Separadores visuales claros
- ✅ **Información a primera vista**: Badge muestra cantidad de noticias
- ✅ **Estética moderna**: Diseño limpio con dark mode

---

## Métricas

### Backend
- **Frecuencia**: 1 ejecución diaria (2:00 AM UTC)
- **Retención**: 30 días
- **Protección**: 100% de favoritos preservados
- **Performance**: O(n) donde n = artículos antiguos

### Frontend
- **Agrupación**: O(n) donde n = total artículos
- **Render**: Un separador por fecha única
- **Responsividad**: Grid adaptable (1-3 columnas)

---

## Próximos Pasos (Futuro)

### Posibles Mejoras

1. **Admin Dashboard**:
   - Panel de control para ejecutar cleanup manual
   - Estadísticas de limpieza (artículos eliminados por día)
   - Configuración dinámica del RETENTION_DAYS

2. **Separadores Avanzados**:
   - Sticky headers al hacer scroll
   - Animación al entrar en viewport
   - Colapsar/expandir grupos de fechas

3. **Analytics**:
   - Tracking de artículos eliminados vs. preservados
   - Notificación a usuarios si un favorito se eliminaría (aunque actualmente nunca ocurre)

---

## Conclusión

Sprint 19.5 implementa dos mejoras críticas:

1. **Limpieza Automática** (Backend): Mantiene la BD ligera y relevante
2. **Separadores de Fecha** (Frontend): Mejora la navegación y contexto temporal

Ambas features son independientes pero complementarias para una mejor experiencia de usuario. ✨

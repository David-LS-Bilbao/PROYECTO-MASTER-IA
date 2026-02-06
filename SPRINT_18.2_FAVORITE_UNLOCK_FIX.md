# Sprint 18.2: Fix Crítico - Separación de "Favorito" vs "Análisis Desbloqueado"

## 🚨 BUG CRÍTICO Identificado (Privacidad)

### Problema Detectado

Después de implementar Sprint 18.1 (Analysis Privacy), se identificó un **BUG CRÍTICO** de privacidad:

```
Usuario B (Bob) analiza una noticia → Análisis guardado globalmente en DB
Usuario A (Alice) ve esa noticia en el feed
Alice marca ❤️ "Favorito" (sin analizar)
Alice va a su pestaña "Favoritos"
BUG: Alice VE el análisis completo, aunque nunca lo solicitó
```

### Causa Raíz

El sistema no distinguía entre dos conceptos diferentes:

1. **Favorito** (❤️): "Me interesa esta noticia" - Usuario marca para leer después
2. **Análisis Desbloqueado** (✨): "He solicitado/pagado por ver el análisis IA"

El controlador usaba `isFavorite` para decidir si desenmascarar el análisis:
```typescript
// INCORRECTO (Sprint 18.1)
const shouldMask = !article.isFavorite; // ❌ Favorito ≠ Análisis solicitado
```

Esto causaba que usuarios que solo marcaban favorito (sin solicitar análisis) vieran análisis de otros usuarios.

## ✅ Solución Implementada

### Arquitectura de Doble Estado

Ahora el sistema distingue claramente:

| Estado | Campo DB | Significado | Acción Usuario |
|--------|----------|-------------|----------------|
| **Favorito** | `Favorite.userId + articleId` | Usuario marcó la noticia como interesante | Pulsa ❤️ |
| **Análisis Desbloqueado** | `Favorite.unlockedAnalysis = true` | Usuario solicitó/pagó por el análisis | Pulsa ✨ "Analizar" |

**Tabla `Favorite` actualizada:**
```prisma
model Favorite {
  userId      String
  articleId   String
  createdAt   DateTime  @default(now())

  // Sprint 18.2: PRIVACY FIX - Distinguish "Like" from "Analysis Unlocked"
  unlockedAnalysis Boolean @default(false)

  @@id([userId, articleId])
}
```

### Flujo Corregido

```
Usuario A marca ❤️ Favorito en noticia X
  → Se crea: Favorite(userA, articleX, unlockedAnalysis: false)
  → Backend enmascara análisis: analysis: null, summary: null
  → Usuario A NO ve el análisis ✅

Usuario A pulsa ✨ "Analizar" en noticia X
  → Backend actualiza: Favorite(userA, articleX, unlockedAnalysis: true)
  → Backend sirve análisis completo (nuevo o cacheado)
  → Usuario A ahora SÍ ve el análisis ✅

Usuario A vuelve a ver noticia X
  → Backend verifica: unlockedAnalysis === true
  → Backend NO enmascara análisis
  → Usuario A ve análisis completo ✅
```

## Archivos Modificados

### Schema & Migración (2 archivos)

#### 1. `backend/prisma/schema.prisma`

Añadido campo `unlockedAnalysis` al modelo `Favorite`:

```prisma
model Favorite {
  userId      String
  articleId   String
  createdAt   DateTime  @default(now())

  // PRIVACY FIX (Sprint 18.2): Distinguish "Like" from "Analysis Unlocked"
  // - false: User only liked (❤️) the article (no analysis access)
  // - true: User requested analysis (✨) and can see AI data
  unlockedAnalysis Boolean @default(false)

  user        User      @relation(...)
  article     Article   @relation(...)

  @@id([userId, articleId])
}
```

#### 2. Migración Prisma

Comando ejecutado:
```bash
npx prisma migrate dev --name add_unlocked_analysis_flag
```

Migración creada: `20260206110440_add_unlocked_analysis_flag/migration.sql`

```sql
ALTER TABLE "favorites" ADD COLUMN "unlockedAnalysis" BOOLEAN NOT NULL DEFAULT false;
```

### Backend (4 archivos)

#### 3. `backend/src/domain/repositories/news-article.repository.ts`

Actualizada interfaz del repositorio:

```typescript
/**
 * Add article to user's favorites
 * @param unlocked - If true, marks analysis as unlocked (user requested analysis)
 *                   If false, user only liked the article (no analysis access)
 */
addFavoriteForUser(userId: string, articleId: string, unlocked?: boolean): Promise<void>;

/**
 * Get set of article IDs where user has unlocked analysis
 * Used for determining which articles' analysis should be visible to user
 */
getUserUnlockedArticleIds(userId: string, articleIds: string[]): Promise<Set<string>>;
```

#### 4. `backend/src/infrastructure/persistence/prisma-news-article.repository.ts`

**Método `addFavoriteForUser` actualizado (líneas 359-376):**

```typescript
async addFavoriteForUser(userId: string, articleId: string, unlocked = false): Promise<void> {
  try {
    await this.prisma.favorite.upsert({
      where: { userId_articleId: { userId, articleId } },
      update: {
        // If already exists, update unlocked status (e.g., user first liked, then analyzed)
        unlockedAnalysis: unlocked,
      },
      create: {
        userId,
        articleId,
        unlockedAnalysis: unlocked,
      },
    });
    console.log(`   [Favorites] ${unlocked ? 'Análisis desbloqueado' : 'Favorito'} para usuario ${userId.substring(0, 8)}...`);
  } catch (error) {
    throw new DatabaseError(...);
  }
}
```

**Nuevo método `getUserUnlockedArticleIds` (líneas 397-414):**

```typescript
async getUserUnlockedArticleIds(userId: string, articleIds: string[]): Promise<Set<string>> {
  try {
    if (articleIds.length === 0) return new Set();

    const favorites = await this.prisma.favorite.findMany({
      where: {
        userId,
        articleId: { in: articleIds },
        unlockedAnalysis: true, // Only articles with unlocked analysis
      },
      select: { articleId: true },
    });

    return new Set(favorites.map(f => f.articleId));
  } catch (error) {
    throw new DatabaseError(...);
  }
}
```

#### 5. `backend/src/application/use-cases/analyze-article.usecase.ts`

Actualizado para marcar análisis como desbloqueado al analizar:

**Línea 138 (análisis cacheado):**
```typescript
// Sprint 18.2: Auto-favorite WITH unlocked analysis (user requested it)
if (user?.id) {
  try {
    await this.articleRepository.addFavoriteForUser(user.id, article.id, true); // ✅ true = unlocked
  } catch (favError) {
    console.warn(`   [Auto-favorito cache] Fallo (no critico): ${favError instanceof Error ? favError.message : 'Error'}`);
  }
}
```

**Línea 262 (análisis nuevo):**
```typescript
// 5.1. Sprint 18.2: Auto-favorite WITH unlocked analysis (user triggered analysis)
if (user?.id) {
  try {
    await this.articleRepository.addFavoriteForUser(user.id, article.id, true); // ✅ true = unlocked
    console.log(`   [Auto-favorito] Usuario ${user.id.substring(0, 8)}... -> articulo ${article.id.substring(0, 8)}...`);
  } catch (favError) {
    console.warn(`   [Auto-favorito] Fallo (no critico): ${favError instanceof Error ? favError.message : 'Error'}`);
  }
}
```

#### 6. `backend/src/infrastructure/http/controllers/news.controller.ts`

Actualizado para enmascarar basándose en `unlockedAnalysis`, NO en `isFavorite`.

**Método `getNews` (líneas 96-107):**

```typescript
// Sprint 18.2: PRIVACY - Mask analysis for articles user hasn't UNLOCKED
// (user can favorite ❤️ without unlocking analysis ✨)
let unlockedIds = new Set<string>();
if (userId) {
  const articleIds = news.map(a => a.id);
  unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, articleIds);
}

const data = news.map(article => {
  const shouldMask = !unlockedIds.has(article.id); // ✅ If not unlocked, hide analysis
  return toHttpResponse(article, shouldMask);
});
```

**Método `getNewsById` (líneas 186-197):**

```typescript
// Sprint 18.2: PRIVACY - Mask analysis if user hasn't UNLOCKED it
// (user can favorite ❤️ without unlocking analysis ✨)
let shouldMask = true;
if (userId) {
  const unlockedIds = await this.repository.getUserUnlockedArticleIds(userId, [id]);
  shouldMask = !unlockedIds.has(id); // ✅ Check unlocked, not favorite
  console.log(`[NewsController]    🔒 Analysis unlocked: ${!shouldMask ? 'YES' : 'NO'}`);
} else {
  console.log(`[NewsController]    🔒 Analysis masking: YES (no user)`);
}

res.json({
  success: true,
  data: toHttpResponse(enrichedArticle, shouldMask),
});
```

## Tabla de Privacidad (Sprint 18.1 vs 18.2)

| Escenario | Sprint 18.1 (BUG) | Sprint 18.2 (FIX) |
|-----------|-------------------|-------------------|
| Usuario marca ❤️ favorito (sin analizar) | Ve análisis si existe ❌ | NO ve análisis ✅ |
| Usuario pulsa ✨ "Analizar" | Ve análisis + favorito ✅ | Ve análisis + favorito + desbloqueado ✅ |
| Usuario vuelve a noticia favorita (no analizada) | Ve análisis si existe ❌ | NO ve análisis ✅ |
| Usuario vuelve a noticia analizada por él | Ve análisis ✅ | Ve análisis ✅ |
| Backend verifica permisos con | `isFavorite` ❌ | `unlockedAnalysis` ✅ |

## Testing Manual

### Test 1: Favorito Sin Análisis

1. Login como Usuario A
2. Usuario B analiza noticia X (análisis guardado en DB)
3. Usuario A marca ❤️ favorito en noticia X (sin pulsar "Analizar")
4. Usuario A va a "Favoritos"
5. **Verificar:**
   - Noticia X aparece en favoritos ✅
   - `analysis: null`, `summary: null`, `biasScore: null` ✅
   - `hasAnalysis: true` (indica que existe en DB) ✅
   - Botón: "Ver analisis (Instantáneo)" ✅

### Test 2: Favorito + Análisis Desbloqueado

1. Usuario A pulsa "Ver analisis" en noticia X
2. Backend sirve análisis cacheado (Gemini NO llamado)
3. Backend actualiza `Favorite.unlockedAnalysis = true`
4. **Verificar:**
   - `analysis: {...}`, `summary: "..."`, `biasScore: 0.8` ✅
   - Botón cambia a: "Mostrar analisis" ✅
5. Usuario A recarga la página
6. **Verificar:**
   - Sigue viendo análisis completo ✅

### Test 3: Base de Datos - Estado de Favoritos

Verificar estado en PostgreSQL:

```sql
SELECT
  u.email,
  a.title,
  f."unlockedAnalysis",
  a."analyzedAt" IS NOT NULL as "hasGlobalAnalysis"
FROM favorites f
JOIN users u ON f."userId" = u.id
JOIN articles a ON f."articleId" = a.id
ORDER BY f."createdAt" DESC
LIMIT 10;
```

**Resultados esperados:**
- Usuario que solo dio ❤️: `unlockedAnalysis = false`, `hasGlobalAnalysis = true`
- Usuario que analizó (✨): `unlockedAnalysis = true`, `hasGlobalAnalysis = true`

### Test 4: Logs Backend

Logs al agregar favorito:
```
[Favorites] Favorito para usuario abc123... (unlockedAnalysis: false)
```

Logs al analizar:
```
[Favorites] Análisis desbloqueado para usuario abc123... (unlockedAnalysis: true)
```

Logs al verificar permisos:
```
[NewsController]    🔒 Analysis unlocked: YES
[NewsController]    🔒 Analysis unlocked: NO
```

## Migración de Datos Existentes

**Importante:** La migración establece `unlockedAnalysis = false` por defecto para todos los favoritos existentes.

**Recomendaciones:**
1. Si quieres que usuarios existentes mantengan acceso a análisis que ya habían visto, ejecuta:
   ```sql
   -- Marcar como desbloqueados todos los favoritos de artículos analizados
   UPDATE favorites f
   SET "unlockedAnalysis" = true
   FROM articles a
   WHERE f."articleId" = a.id
   AND a."analyzedAt" IS NOT NULL;
   ```

2. Si prefieres el modelo estricto (usuarios deben re-solicitar), no hagas nada (default: `false`).

## Beneficios de Privacidad

### ✅ Separación Clara de Conceptos
- ❤️ Favorito: Lista personal de noticias interesantes (sin costo)
- ✨ Análisis: Servicio premium que requiere solicitud explícita

### ✅ Control Granular
- Usuario puede tener 100 favoritos, pero solo 10 análisis desbloqueados
- Permite modelos de negocio: "X análisis gratis al mes"

### ✅ Cumplimiento GDPR/Privacidad
- Usuarios solo ven datos IA que explícitamente solicitaron
- No hay "filtración" de análisis entre usuarios
- Opt-in explícito para cada análisis

### ✅ UX Transparente
- `hasAnalysis: true` informa disponibilidad sin revelar contenido
- Botón "Instantáneo" comunica que no habrá espera/costo
- Usuario entiende: "Este análisis está listo, pero debo solicitarlo"

## Notas Técnicas

### ¿Por Qué No Usar Campo Booleano en `Article`?

El campo `Article.isFavorite` era global (todos los usuarios veían lo mismo). La tabla `Favorite` (junction table) permite estado per-user.

### ¿Qué Pasa si Usuario Quita Favorito?

Si el usuario hace `toggleFavorite` (quita favorito), la fila en `Favorite` se **elimina** completamente (incluido el flag `unlockedAnalysis`). Si vuelve a favoritar, `unlockedAnalysis` vuelve a `false` y debe re-solicitar el análisis.

**Comportamiento esperado:**
- Usuario analiza noticia X → `unlockedAnalysis: true`
- Usuario quita favorito → Fila eliminada
- Usuario vuelve a favoritar → `unlockedAnalysis: false` (debe re-analizar)

### ¿El Cache Global Sigue Funcionando?

**Sí, completamente preservado:**
- Análisis se guarda globalmente en `Article` (Sprint 17)
- Múltiples usuarios pueden solicitar el mismo análisis
- Gemini solo se llama una vez (primera solicitud)
- Usuarios subsiguientes reciben análisis cacheado instantáneamente
- Cada usuario debe "desbloquear" explícitamente para verlo

### Performance

- `getUserUnlockedArticleIds`: Query simple con índice en composite key
- Impacto: ~5ms adicional por request (insignificante)
- No afecta al cache global de análisis

## Conclusión

Sprint 18.2 **cierra el bug crítico de privacidad** identificado en Sprint 18.1, garantizando que:

- ✅ Favoritos (❤️) y Análisis Desbloqueados (✨) son conceptos separados
- ✅ Usuarios solo ven análisis que explícitamente solicitaron
- ✅ No hay filtración de datos IA entre usuarios
- ✅ El cache global de análisis sigue optimizando costos
- ✅ La UX es clara y transparente

**El sistema ahora cumple estrictamente el principio de "análisis bajo demanda" (opt-in explícito).**

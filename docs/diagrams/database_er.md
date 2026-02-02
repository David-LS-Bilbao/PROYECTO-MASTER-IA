# Diagrama Entidad-Relación (ERD) - Verity News

> Generado a partir de `backend/prisma/schema.prisma` y `domain/entities/news-article.entity.ts`

## Descripción

Este diagrama muestra el modelo de datos completo de Verity News, incluyendo:
- **Entidad principal**: `Article` con campos de análisis IA
- **Value Objects JSON**: `ArticleAnalysis`, `FactCheck`, `TokenUsage`
- **Enumerados**: Categorías, Sentiment, Verdict
- **Relaciones**: User → Favorites, Chat → Messages

---

## Diagrama ERD Principal

```mermaid
erDiagram
    %% ═══════════════════════════════════════════════════════════════════════════
    %% ENTIDAD PRINCIPAL: ARTICLE (NewsArticle)
    %% ═══════════════════════════════════════════════════════════════════════════
    Article {
        UUID id PK "Identificador único"
        String title "Título de la noticia (required)"
        String description "Resumen del RSS (nullable)"
        Text content "Contenido scrapeado con Jina (nullable)"
        String url UK "URL única del artículo (required)"
        String urlToImage "URL imagen destacada (nullable)"
        String source "Medio de comunicación (required)"
        String author "Autor del artículo (nullable)"
        DateTime publishedAt "Fecha de publicación original"
        String category "Categoría RSS (nullable)"
        String language "Idioma - default: es"
        Text embedding "Vector 768d JSON (nullable)"
        Text summary "Resumen generado por Gemini (nullable)"
        Float biasScore "Score sesgo normalizado 0-1 (nullable)"
        Text analysis "ArticleAnalysis JSON (nullable)"
        DateTime analyzedAt "Timestamp análisis IA (nullable)"
        Boolean isFavorite "Marcado como favorito - default: false"
        DateTime fetchedAt "Fecha de ingesta RSS"
        DateTime updatedAt "Última modificación"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% VALUE OBJECT: ArticleAnalysis (JSON en Article.analysis)
    %% ═══════════════════════════════════════════════════════════════════════════
    ArticleAnalysis {
        String summary "Resumen generado por IA"
        Float biasScore "Score normalizado 0-1 para UI"
        Int biasRaw "Score crudo -10 a +10"
        Array biasIndicators "Lista de indicadores de sesgo"
        Int clickbaitScore "0 (Serio) a 100 (Clickbait)"
        Int reliabilityScore "0 (Bulo) a 100 (Verificado)"
        Enum sentiment "positive | negative | neutral"
        Array mainTopics "Temas principales detectados"
        Object factCheck "FactCheck embedded object"
        Array factualClaims "Claims legacy (deprecated)"
        Object usage "TokenUsage opcional"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% VALUE OBJECT: FactCheck (embedded en ArticleAnalysis)
    %% ═══════════════════════════════════════════════════════════════════════════
    FactCheck {
        Array claims "Lista de afirmaciones verificadas"
        Enum verdict "Verified | Mixed | Unproven | False"
        String reasoning "Explicación del veredicto"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% VALUE OBJECT: TokenUsage (Sprint 8.2 - Token Taximeter)
    %% ═══════════════════════════════════════════════════════════════════════════
    TokenUsage {
        Int promptTokens "Tokens de entrada enviados"
        Int completionTokens "Tokens de salida recibidos"
        Int totalTokens "promptTokens + completionTokens"
        Float costEstimated "Coste estimado en EUR"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% ENTIDADES DE USUARIO
    %% ═══════════════════════════════════════════════════════════════════════════
    User {
        UUID id PK "Identificador único"
        String firebaseUid UK "Firebase Authentication UID"
        String email UK "Email único del usuario"
        String displayName "Nombre mostrado (nullable)"
        String photoURL "URL del avatar (nullable)"
        DateTime createdAt "Fecha de registro"
        DateTime updatedAt "Última actualización"
    }

    Favorite {
        UUID id PK "Identificador único"
        UUID userId FK "Referencia a User"
        UUID articleId FK "Referencia a Article"
        DateTime createdAt "Fecha de marcado"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% SISTEMA DE CHAT RAG
    %% ═══════════════════════════════════════════════════════════════════════════
    Chat {
        UUID id PK "Identificador único"
        UUID userId FK "Referencia a User"
        String title "Título de la conversación (nullable)"
        DateTime createdAt "Fecha de creación"
        DateTime updatedAt "Última actividad"
    }

    Message {
        UUID id PK "Identificador único"
        UUID chatId FK "Referencia a Chat"
        String role "user | assistant | system"
        Text content "Contenido del mensaje"
        Text sources "JSON array de fuentes RAG (nullable)"
        DateTime createdAt "Timestamp del mensaje"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% HISTORIAL Y METADATA
    %% ═══════════════════════════════════════════════════════════════════════════
    SearchHistory {
        UUID id PK "Identificador único"
        UUID userId FK "Referencia a User"
        String query "Término de búsqueda"
        Text filters "JSON con filtros aplicados (nullable)"
        Int resultsCount "Número de resultados - default: 0"
        DateTime createdAt "Fecha de búsqueda"
    }

    IngestMetadata {
        UUID id PK "Identificador único"
        String source "newsapi | google-news | direct-rss"
        DateTime lastFetch "Timestamp última ingesta"
        Int articlesCount "Artículos ingestados - default: 0"
        String status "success | error"
        Text errorMessage "Mensaje de error (nullable)"
    }

    %% ═══════════════════════════════════════════════════════════════════════════
    %% RELACIONES ENTRE ENTIDADES
    %% ═══════════════════════════════════════════════════════════════════════════

    %% Relaciones de Usuario
    User ||--o{ Favorite : "marca como favorito"
    User ||--o{ SearchHistory : "realiza búsquedas"
    User ||--o{ Chat : "inicia conversaciones"

    %% Relaciones de Artículo
    Article ||--o{ Favorite : "es marcado por"
    Article ||--|| ArticleAnalysis : "contiene JSON"

    %% Relaciones de Chat
    Chat ||--o{ Message : "contiene mensajes"

    %% Relaciones de Value Objects (JSON embedded)
    ArticleAnalysis ||--|| FactCheck : "incluye verificación"
    ArticleAnalysis ||--o| TokenUsage : "registra costes"
```

---

## Enumerados del Sistema

```mermaid
erDiagram
    %% ═══════════════════════════════════════════════════════════════════════════
    %% ENUMERADOS
    %% ═══════════════════════════════════════════════════════════════════════════

    CategoryEnum {
        String general "Noticias generales"
        String internacional "Noticias internacionales"
        String deportes "Deportes"
        String economia "Economía y finanzas"
        String politica "Política nacional"
        String ciencia "Ciencia y salud"
        String tecnologia "Tecnología"
        String cultura "Cultura y entretenimiento"
    }

    SentimentEnum {
        String positive "Tono positivo"
        String negative "Tono negativo"
        String neutral "Tono neutral"
    }

    VerdictEnum {
        String Verified "Información verificada"
        String Mixed "Parcialmente verificada"
        String Unproven "No comprobable"
        String False "Información falsa"
    }

    MessageRoleEnum {
        String user "Mensaje del usuario"
        String assistant "Respuesta de Gemini"
        String system "Instrucción del sistema"
    }

    IngestStatusEnum {
        String success "Ingesta exitosa"
        String error "Ingesta fallida"
    }

    %% Relaciones con enumerados
    CategoryEnum ||--o{ Article : "clasifica"
    SentimentEnum ||--o{ ArticleAnalysis : "califica"
    VerdictEnum ||--o{ FactCheck : "determina"
    MessageRoleEnum ||--o{ Message : "identifica"
    IngestStatusEnum ||--o{ IngestMetadata : "indica"
```

---

## Estructura JSON: ArticleAnalysis

El campo `Article.analysis` almacena un JSON con la siguiente estructura:

```json
{
  "summary": "Resumen de 2-3 frases generado por Gemini",
  "biasScore": 0.3,
  "biasRaw": -3,
  "biasIndicators": [
    "Uso de adjetivos valorativos",
    "Énfasis en aspectos negativos"
  ],
  "clickbaitScore": 25,
  "reliabilityScore": 85,
  "sentiment": "negative",
  "mainTopics": ["economía", "inflación", "BCE"],
  "factCheck": {
    "claims": [
      "La inflación alcanzó el 3.5% en enero",
      "El BCE mantiene los tipos de interés"
    ],
    "verdict": "Verified",
    "reasoning": "Datos oficiales del INE y comunicado del BCE"
  },
  "factualClaims": ["claim1", "claim2"],
  "usage": {
    "promptTokens": 1234,
    "completionTokens": 456,
    "totalTokens": 1690,
    "costEstimated": 0.000223
  }
}
```

---

## Índices de Rendimiento (PostgreSQL)

| Tabla | Campo | Tipo | Propósito |
|-------|-------|------|-----------|
| `articles` | `publishedAt` | B-tree | Ordenación cronológica |
| `articles` | `source` | B-tree | Filtrado por medio |
| `articles` | `category` | B-tree | Filtrado por categoría |
| `articles` | `analyzedAt` | B-tree | Identificar pendientes de análisis |
| `search_history` | `userId` | B-tree | Historial por usuario |
| `search_history` | `createdAt` | B-tree | Ordenación temporal |
| `messages` | `chatId` | B-tree | Mensajes por conversación |

---

## Constraints y Validaciones

### Unique Constraints
- `Article.url` - Evita duplicados de noticias
- `User.firebaseUid` - Un usuario por cuenta Firebase
- `User.email` - Un email por usuario
- `Favorite(userId, articleId)` - Un favorito por usuario/artículo

### Cascade Delete
- `User` → elimina `Favorite`, `SearchHistory`, `Chat`
- `Article` → elimina `Favorite`
- `Chat` → elimina `Message`

### Defaults
- `Article.language` = `"es"`
- `Article.isFavorite` = `false`
- `Article.fetchedAt` = `now()`
- `SearchHistory.resultsCount` = `0`
- `IngestMetadata.articlesCount` = `0`

---

## Notas para la Memoria TFM

1. **Desnormalización controlada**: El campo `analysis` almacena JSON para evitar JOINs costosos en lecturas frecuentes.

2. **Token Taximeter** (Sprint 8.2): El campo `usage` dentro de `ArticleAnalysis` permite auditar costes de IA por artículo.

3. **Escalabilidad**: Los índices en `publishedAt`, `source` y `category` optimizan las queries más frecuentes del frontend.

4. **Soft vs Hard Delete**: Se usa Cascade Delete para mantener integridad referencial. No hay soft delete implementado.

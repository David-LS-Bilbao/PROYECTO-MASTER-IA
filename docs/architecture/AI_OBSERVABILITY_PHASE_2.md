# Fase 2 - Instrumentacion Persistente de Verity

## Alcance implementado
- Extension de la capa persistente de observabilidad IA (Fase 1) al resto de operaciones IA reales de Verity.
- Sin cambios de UI publica.
- Sin romper `TokenTaximeter`, logs de consola ni flujos actuales.

## Precondicion operativa (drift de migraciones)
- Base principal local (`verity_news`) con drift detectado:
  - Migracion local no aplicada en DB: `20260321100000_add_ai_observability_core`
  - Migracion en DB no presente localmente: `20260217124621_add_article_access_status`
- Flujo seguro usado para validacion:
  - Creacion de DB limpia: `verity_news_ai_obs`
  - `prisma migrate deploy` sobre DB limpia
  - Estado final: `Database schema is up to date!`

## Operaciones IA de Verity instrumentadas en `ai_operation_runs`
- `article_analysis` (ya de Fase 1, se mantiene)
- `rag_chat`
- `general_chat_grounding`
- `grounding_chat`
- `embedding_generation`
- `json_repair`
- `rss_discovery`
- `local_source_discovery`

## Cobertura por flujo
- Chat articulo (RAG):
  - embedding de pregunta (`embedding_generation`)
  - generacion respuesta RAG (`rag_chat`)
- Chat general con grounding:
  - `general_chat_grounding`
  - correccion de bucket en taximetro: usa `logGroundingChat` (no `logRagChat`)
- JSON repair interno:
  - run propio `json_repair`
  - comparte `correlationId` con flujo padre cuando aplica
- Embeddings:
  - run persistido siempre
  - si no hay `usageMetadata`, tokens se guardan en `null` y `metadataJson.tokenUsageAvailable=false`
- RSS discovery:
  - `rss_discovery` con prompt versionado
- Local source discovery:
  - `local_source_discovery` en `GeminiClient.discoverLocalSources`
  - ademas, discovery local via use case reutiliza contrato de observabilidad en `generateGeneralResponse`

## Registro de prompts/versiones
- RAG chat: `RAG_CHAT_PROMPT` v`5.0.0`
- Grounding chat: `GROUNDING_CHAT_PROMPT` v`2.0.0`
- General chat: `GENERAL_CHAT_SYSTEM_PROMPT` v`2.0.0`
- RSS discovery: `RSS_DISCOVERY_PROMPT` v`2.0.0`
- Local sources discovery: `LOCATION_SOURCES_PROMPT` v`1.0.0` / `LOCAL_SOURCES_DISCOVERY_PROMPT` v`1.0.0` (segun flujo)
- JSON repair: `JSON_REPAIR_PROMPT` v`1.0.0`

## Endpoints admin (sin frontend)
- Se mantienen:
  - `GET /api/admin/ai-usage/overview`
  - `GET /api/admin/ai-usage/runs`
- Filtros activos en runs/overview:
  - `module`, `operationKey`, `provider`, `model`, `status`
  - `requestId`, `correlationId`, `entityType`, `entityId`, `from`, `to`
- `overview` ampliado con agregaciones:
  - `byStatus`
  - `byModule`
  - `byOperation`
  - `byProviderModel`
  - `recentErrors`

## Redaccion y seguridad de telemetria
- Se mantiene politica de Fase 1:
  - no guardar prompts interpolados completos por defecto
  - no guardar respuestas completas del modelo por defecto
  - no guardar contenido integro de usuario/articulo en telemetria
- Persistencia principal:
  - `promptKey`, `promptVersion`, `templateHash`, `sourceFile`
  - metadatos operativos seguros (longitudes, contadores, flags de disponibilidad)

## Limitaciones actuales
- Embeddings dependen de si el proveedor devuelve `usageMetadata`; no se inventan tokens.
- `isAvailable()` no se instrumenta como run (healthcheck tecnico, no operacion funcional de negocio).
- Sigue pendiente hardening de autorizacion admin por rol dedicado interno.

## Pendiente para Fase 3
- Instrumentacion equivalente en Media Bias Atlas:
  - `GeminiArticleBiasAIProvider`
  - `OpenAICompatibleArticleBiasAIProvider`
- Comparabilidad inter-modulo Verity vs MBA sobre el mismo esquema de runs.

## Validacion ejecutada
- `npm run typecheck`
- `npm run build`
- `npx vitest run src/infrastructure/external/gemini.client.spec.ts src/infrastructure/observability/ai-observability.service.spec.ts src/infrastructure/observability/token-and-cost.service.spec.ts src/application/use-cases/analyze-article.usecase.spec.ts tests/application/chat-article.usecase.spec.ts tests/application/chat-general.usecase.spec.ts tests/application/search-news.usecase.spec.ts tests/infrastructure/http/controllers/sources.controller.spec.ts`
- Drift check:
  - `npx prisma migrate status --schema prisma/schema.prisma` sobre `verity_news` (drift)
  - `npx prisma migrate deploy --schema prisma/schema.prisma` + `status` sobre `verity_news_ai_obs` (alineada)

# Fase 1 - Núcleo de Observabilidad IA

## Alcance implementado
- Persistencia base para observabilidad IA en backend de Verity.
- Servicios comunes reutilizables por Verity y Media Bias Atlas.
- Primera integración real en `analyze article` de Verity.
- Endpoints admin internos para consultar overview y runs.
- Política de redacción y retención centralizada.

## Tablas creadas (Prisma)
- `ai_prompt_versions`
  - Registro versionado de prompts por `module + promptKey + version`.
  - Guarda `templateHash`, `sourceFile`, `metadataJson`.
- `ai_model_pricing`
  - Catálogo de precios por `provider/model`.
  - Costes en `micros EUR por 1M tokens` (`BigInt`).
- `ai_operation_runs`
  - Registro de ejecuciones IA con estado común (`AiRunStatus`).
  - Incluye `requestId`, `correlationId`, tokens, coste estimado, latencia, errores y metadata.

### Enum común
- `AiRunStatus`
  - `PENDING`, `COMPLETED`, `FAILED`, `TIMEOUT`, `CANCELLED`

### Índices incluidos desde migración inicial
- `created_at`
- `(module, operation_key, created_at)`
- `(provider, model, created_at)`
- `(status, created_at)`
- `request_id`
- `(entity_type, entity_id, created_at)`

## Servicios añadidos
- `AIObservabilityService`
  - `startRun`, `completeRun`, `failRun`
  - `getOverview`, `listRuns`
  - `enforceRetentionPolicies`
  - Redacción centralizada de payloads sensibles.
- `PromptRegistryService`
  - Alta/registro de versiones de prompt con hash SHA-256.
- `TokenAndCostService`
  - Cálculo de coste estimado en micros EUR contra catálogo (`ai_model_pricing`).
  - Seed inicial de catálogo por defecto (si no existe pricing activo).

## Primera operación instrumentada (Verity)
- Flujo instrumentado: `POST /api/analyze/article` -> `AnalyzeArticleUseCase` -> `GeminiClient.analyzeArticle`.
- Se persiste un run real en `ai_operation_runs` durante la ejecución IA de análisis.
- Campos registrados:
  - `module`, `operationKey`, `provider`, `model`, `status`
  - `promptVersionId`, `requestId`, `correlationId`, `endpoint`
  - `userId`, `entityType`, `entityId`
  - `promptTokens`, `completionTokens`, `totalTokens`
  - `estimatedCostMicrosEur`, `latencyMs`
  - `errorCode`, `errorMessage`, `metadataJson`, `createdAt`

## Endpoints admin internos
- `GET /api/admin/ai-usage/overview`
- `GET /api/admin/ai-usage/runs`
- Protección: secreto interno (`x-admin-secret` o `x-cron-secret`).

## Política de redacción y retención
- Redacción activa desde Fase 1:
  - No se persisten prompts interpolados completos.
  - No se persisten respuestas completas del modelo.
  - No se persiste contenido íntegro de usuario/artículo en telemetría.
- Se persiste:
  - `promptKey`, `version`, `templateHash`, `sourceFile`, metadatos operativos.
- Retención preparada:
  - Runs: 180 días (borrado por `created_at`).
  - Debug payloads: 30 días (scrub de `debug_payload_json`).

## Compatibilidad
- `TokenTaximeter` se mantiene sin eliminar ni romper flujos actuales.
- La nueva capa persistente convive con observabilidad previa en consola/Sentry.

## Pendiente para Fase 2
- Instrumentar el resto de operaciones IA de Verity:
  - chat RAG
  - chat general
  - JSON repair
  - embeddings
  - RSS discovery
- Endurecer autorización admin (roles internos dedicados).
- Añadir tareas programadas para retención automática.

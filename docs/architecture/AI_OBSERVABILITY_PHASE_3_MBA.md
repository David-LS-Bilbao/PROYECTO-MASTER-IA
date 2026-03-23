# Fase 3 - Instrumentacion Persistente de Media Bias Atlas

## Alcance implementado
- Instrumentacion persistente de las operaciones IA reales de `media-bias-atlas/backend`.
- Sin UI nueva.
- Sin romper `article_bias_analysis`, endpoints actuales ni frontend del atlas.

## Convencion comun usada
- `module = media-bias-atlas`
- `operationKey = article_bias_analysis`
- estados comunes:
  - `PENDING`
  - `COMPLETED`
  - `FAILED`
  - `TIMEOUT`
  - `CANCELLED`

## Operaciones MBA instrumentadas en `ai_operation_runs`
- `POST /api/articles/:articleId/analyze-bias`
  - genera un run persistente cuando el flujo llega a invocar IA real.
- `POST /api/feeds/:feedId/analyze-bias`
  - no crea un run agregado de feed.
  - genera runs por articulo segun el flujo real del caso de uso.

## Providers soportados e instrumentados
- `GeminiArticleBiasAIProvider`
  - registra modelo, latencia y estado.
  - persiste tokens reales si `usageMetadata` viene en la respuesta del SDK.
- `OpenAICompatibleArticleBiasAIProvider`
  - registra modelo, latencia y estado.
  - persiste tokens reales si `usage` viene en el payload de `chat/completions`.

## Prompt registry en MBA
- prompts reales versionados desde `src/infrastructure/ai/articleBiasPrompt.ts`
- claves registradas:
  - `article_bias_prompt`
  - `article_bias_instructions`
  - `article_bias_input_context`
- comportamiento por provider:
  - Gemini usa `article_bias_prompt` como prompt principal del run.
  - OpenAI-compatible usa `article_bias_instructions` como prompt principal y deja `article_bias_input_context` como prompt relacionado en metadata.

## Datos persistidos por run
- `module`
- `operationKey`
- `provider`
- `model`
- `status`
- `promptVersionId` cuando existe
- `requestId`
- `correlationId`
- `endpoint` cuando el contexto HTTP esta disponible
- `entityType` / `entityId`
- `promptTokens`
- `completionTokens`
- `totalTokens`
- `estimatedCostMicrosEur`
- `latencyMs`
- `errorCode`
- `errorMessage`
- `metadataJson`
- `createdAt`

## Redaccion y seguridad
- no se guardan prompts interpolados completos en `ai_operation_runs`
- no se guarda la respuesta completa del modelo en `ai_operation_runs`
- no se guarda contenido integro del articulo dentro de telemetria
- si hay metadata sensible o demasiado larga, se redacta/trunca antes de persistir
- `article_bias_analysis` mantiene su persistencia funcional actual, incluida `rawJson`

## Coste y tokens
- `estimatedCostMicrosEur` solo se calcula cuando hay tokens reales y pricing utilizable
- si el provider no devuelve usage real:
  - `promptTokens`, `completionTokens` y `totalTokens` quedan en `null`
  - `estimatedCostMicrosEur` queda en `null`
- pricing por defecto cargado:
  - `gemini` / `google` para `gemini-2.5-flash`
- en `openai-compatible` el coste queda en `null` mientras no exista pricing activo para el modelo configurado

## Endpoints admin internos
- `GET /api/admin/ai-usage/overview`
- `GET /api/admin/ai-usage/runs`
- proteccion:
  - requieren `x-admin-secret` o `x-cron-secret`
  - usan `ADMIN_API_SECRET` o `CRON_SECRET`
- filtros soportados:
  - `module`
  - `operationKey`
  - `provider`
  - `model`
  - `status`
  - `requestId`
  - `correlationId`
  - `entityType`
  - `entityId`
  - `from`
  - `to`

## Limitaciones actuales
- si el articulo no es politico o no llega a invocar IA, no se crea run de observabilidad porque no existe operacion IA real.
- `AnalyzeFeedBiasUseCase` genera trazabilidad por articulo, no un run agregado independiente del feed.
- la autorizacion admin sigue basada en secreto interno, no en roles dedicados.
- el cliente Prisma existente de MBA no expone todavia estos modelos; la capa de observabilidad opera con SQL parametrizado sobre el mismo esquema para no romper el MVP actual.

## Pendiente para Fase 4
- UI interna de gestion de uso de IA.
- visualizaciones de overview, runs, prompts y comparador de modelos.
- hardening adicional de autorizacion admin.

## Validacion local recomendada
```bash
cd "media-bias-atlas/backend"

# Typecheck
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx tsc --noEmit

# Unit tests
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run tests/unit

# Aplicar migracion en un entorno con PostgreSQL accesible
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx prisma migrate deploy

# Ejemplo de consulta admin interna
curl -s \
  -H "x-admin-secret: $ADMIN_API_SECRET" \
  "http://localhost:3001/api/admin/ai-usage/runs?module=media-bias-atlas&operationKey=article_bias_analysis"
```

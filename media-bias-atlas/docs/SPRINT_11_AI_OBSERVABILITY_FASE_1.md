# Sprint 11 - Fase 1 de Observabilidad IA (estado de ejecucion)

Fecha: 2026-03-22

## 1. Objetivo del sprint

Dejar implementado el nucleo comun de observabilidad IA en el repositorio para empezar por Verity y preparar la instrumentacion de Media Bias Atlas sin duplicar contratos.

## 2. Estado de implementacion real

La Fase 1 ya esta implementada en `backend` (Verity) con primera integracion real en el flujo de analisis de articulo.

Implementado:

- enum comun `AiRunStatus`:
  - `PENDING`
  - `COMPLETED`
  - `FAILED`
  - `TIMEOUT`
  - `CANCELLED`
- tablas:
  - `ai_prompt_versions`
  - `ai_model_pricing`
  - `ai_operation_runs`
- indices iniciales de `ai_operation_runs` desde migracion inicial;
- servicios comunes:
  - `PromptRegistryService`
  - `TokenAndCostService`
  - `AIObservabilityService`
- coste persistido en `estimatedCostMicrosEur` (`BigInt`, micros EUR);
- registro de `requestId` y `correlationId` en cada run;
- endpoints admin internos:
  - `GET /api/admin/ai-usage/overview`
  - `GET /api/admin/ai-usage/runs`

## 3. Politica de redaccion y retencion

Aplicada/centralizada desde Fase 1:

- no guardar prompts interpolados completos por defecto;
- no guardar respuestas completas del modelo por defecto;
- no guardar contenido integro de usuario o articulo dentro de telemetria;
- guardar identificadores tecnicos, versionado y metadatos operativos.

Retencion preparada:

- runs: 180 dias;
- payload/debug: 30 dias.

## 4. Estado especifico de Media Bias Atlas

Pendiente de instrumentar en MBA:

- `GeminiArticleBiasAIProvider`;
- `OpenAICompatibleArticleBiasAIProvider`.

Alcance de la siguiente fase para MBA:

- persistir `provider`, `model`, `promptVersion`, `status/error`;
- persistir `promptTokens`, `completionTokens`, `totalTokens`;
- persistir `estimatedCostMicrosEur` y `latencyMs`;
- mantener semantica comun con Verity para comparabilidad.

## 5. Riesgos abiertos

- migracion pendiente de aplicacion en entornos donde PostgreSQL no este levantado;
- autorizacion admin actualmente basada en secreto interno (evolucionar a control por roles internos cuando toque UI);
- falta ejecutar jobs programados de retencion en entorno productivo.

## 6. Criterio de cierre de esta fase

Se considera cerrada la Fase 1 porque:

- existe contrato comun de observabilidad persistente;
- existe operacion real ya instrumentada;
- existe consulta admin para validar datos;
- se mantiene compatibilidad con el flujo actual (`TokenTaximeter` no se elimina).

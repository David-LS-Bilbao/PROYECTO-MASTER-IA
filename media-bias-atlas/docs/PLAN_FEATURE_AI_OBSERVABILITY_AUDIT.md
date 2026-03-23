# Plan oficial de implementación — Feature AI Observability Audit

## 1. Objetivo de la feature

Crear una capa común de observabilidad del uso de Inteligencia Artificial para el repositorio `PROYECTO-MASTER-IA`, comenzando por Verity News y dejando la base preparada para Media Bias Atlas.

El objetivo no es empezar por una interfaz visual, sino por una telemetría persistente, comparable y segura que permita:

- medir consumo real de tokens;
- estimar coste por operación;
- registrar proveedor, modelo y versión de prompt;
- comparar flujos y modelos con datos históricos;
- preparar una futura pantalla interna de gestión del uso de IA.

---

## 2. Principios de diseño ya decididos

### 2.1 ENUM común de estado

Se define un enum único para Verity y Media Bias Atlas:

- `PENDING`
- `COMPLETED`
- `FAILED`
- `TIMEOUT`
- `CANCELLED`

Nombre recomendado:

- Prisma: `AiRunStatus`
- Código: `AiRunStatus`

Esto evita divergencias entre módulos y simplifica backend, filtros y futura UI.

### 2.2 Coste en unidad fija

El coste no debe almacenarse como `Float`.

Se usará unidad fija en **micros de EUR**:

- `estimatedCostMicrosEur: BigInt`

Ejemplo:

- `0.002345 €` → `2345`

Esto reduce errores de redondeo y mejora agregados, comparativas y reporting.

### 2.3 Trazabilidad por request y correlación

Cada ejecución IA debe guardar:

- `requestId`
- `correlationId`

Uso recomendado:

- `requestId`: identifica la request HTTP concreta;
- `correlationId`: agrupa varias operaciones IA dentro del mismo flujo lógico.

Ejemplo:

- análisis de artículo;
- reparación JSON;
- embedding;

pueden compartir `correlationId` aunque sean pasos distintos.

### 2.4 Redacción de datos sensibles desde Fase 1

La telemetría no debe convertirse en un volcado de contenido sensible.

Por defecto **no se guardará**:

- prompt interpolado completo;
- respuesta completa del modelo;
- texto íntegro del usuario;
- texto íntegro del artículo;
- payloads con PII sin redacción.

Sí se guardará:

- `promptKey`;
- `version`;
- `templateHash`;
- `sourceFile`;
- metadatos operativos;
- previews truncadas y redactadas solo si realmente hacen falta.

### 2.5 Retención desde Fase 1

Se deja definida desde el inicio una política mínima:

- `ai_operation_runs`: 180 días;
- payloads/debug opcionales: 30 días;
- prompts versionados: permanentes mientras estén activos o referenciados.

Debe quedar preparada una limpieza programada futura, aunque el job de purga completo pueda implementarse en una fase posterior.

---

## 3. Alcance por fases

## Fase 1 — Núcleo de observabilidad IA

### Objetivo

Construir la base persistente y común del sistema de observabilidad IA.

### Alcance

- nuevas tablas Prisma;
- índices desde la primera migración;
- servicios backend comunes;
- política de redacción centralizada;
- primera integración real en Verity: análisis de artículo;
- endpoints admin mínimos de consulta.

### Resultado esperado

- ya existe histórico persistente de runs IA;
- el diseño sirve para Verity y para MBA;
- no depende todavía de la UI final.

---

## Fase 2 — Instrumentación completa en Verity

### Objetivo

Extender la nueva capa a todos los puntos principales de uso IA en Verity.

### Alcance recomendado

- análisis de artículo;
- chat RAG;
- chat general;
- JSON repair;
- embeddings;
- RSS discovery;
- local source discovery.

### Resultado esperado

- Verity deja de depender solo del taxímetro en memoria;
- existe histórico comparable por operación, proveedor y modelo.

---

## Fase 3 — Instrumentación en Media Bias Atlas

### Objetivo

Alinear MBA con el mismo contrato de observabilidad.

### Alcance

- `GeminiArticleBiasAIProvider`;
- `OpenAICompatibleArticleBiasAIProvider`;
- persistencia de tokens, coste, latencia, prompt y estado.

### Resultado esperado

- Verity y MBA pueden compararse con el mismo esquema;
- queda preparada la comparación entre proveedores/modelos.

---

## Fase 4 — Pantalla interna “Gestión de uso de Inteligencia Artificial”

### Objetivo

Construir la capa visual solo cuando los datos ya existan y sean fiables.

### Vistas mínimas

- Resumen;
- Ejecuciones;
- Prompts;
- Comparador de modelos.

### Restricción

La UI debe ser **interna/admin**, no pública.

---

## 4. Diseño de datos MVP

## 4.1 Tabla `ai_prompt_versions`

### Propósito

Versionar prompts de forma trazable sin guardar por defecto el prompt interpolado completo.

### Campos recomendados

- `id`
- `module`
- `promptKey`
- `version`
- `templateHash`
- `sourceFile`
- `isActive`
- `createdAt`

### Uso

Permite saber qué prompt base se utilizó en cada operación IA.

---

## 4.2 Tabla `ai_model_pricing`

### Propósito

Centralizar catálogo de precios por proveedor y modelo.

### Campos recomendados

- `id`
- `provider`
- `model`
- `currencyCode`
- `inputCostMicrosPer1M`
- `outputCostMicrosPer1M`
- `validFrom`
- `validTo`

### Uso

El cálculo de coste no debe depender de números mágicos repartidos por el código.

---

## 4.3 Tabla `ai_operation_runs`

### Propósito

Registrar cada ejecución IA relevante como unidad histórica trazable.

### Campos recomendados

- `id`
- `module`
- `operationKey`
- `provider`
- `model`
- `status` (`AiRunStatus`)
- `promptVersionId`
- `requestId`
- `correlationId`
- `endpoint`
- `userId`
- `entityType`
- `entityId`
- `promptTokens`
- `completionTokens`
- `totalTokens`
- `estimatedCostMicrosEur`
- `latencyMs`
- `errorCode`
- `errorMessage`
- `metadataJson`
- `createdAt`

### Índices mínimos desde la migración inicial

- `created_at`
- `(module, operation_key, created_at)`
- `(provider, model, created_at)`
- `(status, created_at)`
- `request_id`
- `(entity_type, entity_id, created_at)`

---

## 5. Servicios backend comunes

## 5.1 `AIObservabilityService`

### Responsabilidad

Gestionar el ciclo de vida de una ejecución IA.

### Métodos esperados

- `startRun(context)`
- `completeRun(metrics)`
- `failRun(error)`

### Debe registrar

- contexto del run;
- tiempos;
- tokens;
- coste;
- errores;
- metadatos seguros.

---

## 5.2 `PromptRegistryService`

### Responsabilidad

Resolver de forma centralizada:

- `promptKey`
- `version`
- `templateHash`
- `sourceFile`

### Objetivo

Evitar prompts “sin identidad” en ejecución.

---

## 5.3 `TokenAndCostService`

### Responsabilidad

- extraer tokens desde la respuesta del proveedor;
- normalizar métricas;
- calcular coste usando `ai_model_pricing`;
- devolver coste en micros de EUR.

### Restricción

No debe depender de floats sueltos hardcodeados en múltiples archivos.

---

## 6. Integración inicial obligatoria en Fase 1

## Verity News — análisis de artículo

La primera integración real debe hacerse solo en el flujo de análisis de artículo.

### Debe registrar como mínimo

- `module = verity`
- `operationKey = article_analysis`
- proveedor
- modelo
- `status`
- referencia a prompt versionado
- `requestId`
- `correlationId`
- endpoint
- `userId` si aplica
- `entityType/entityId`
- `promptTokens`
- `completionTokens`
- `totalTokens`
- `estimatedCostMicrosEur`
- `latencyMs`
- `errorCode/errorMessage`
- `metadataJson`
- `createdAt`

### Compatibilidad

- no romper `TokenTaximeter`;
- no eliminar observabilidad ya existente;
- añadir la nueva capa persistente sin rehacer medio sistema.

---

## 7. Endpoints admin mínimos de Fase 1

Se deben exponer como mínimo:

- `GET /api/admin/ai-usage/overview`
- `GET /api/admin/ai-usage/runs`

### Objetivo

Permitir validación temprana sin depender todavía de frontend visual completo.

---

## 8. Política de redacción

## Regla general

La telemetría debe registrar **uso**, no **contenido completo**.

### No guardar por defecto

- prompt interpolado completo;
- respuesta completa del LLM;
- artículo íntegro;
- preguntas completas del usuario;
- contenido sensible sin filtrar.

### Sí guardar

- identificadores técnicos;
- hashes de plantilla;
- nombres/versiones de prompt;
- metadatos agregados;
- previews truncadas y redactadas solo cuando sean necesarias para debugging controlado.

### Recomendación técnica

Centralizar esta política en helpers reutilizables para que Verity y MBA no diverjan.

---

## 9. Política de retención

## Mínimo definido desde Fase 1

- runs: 180 días;
- payloads/debug opcionales: 30 días;
- prompts versionados: permanentes mientras estén en uso o referenciados.

### Recomendación

Preparar desde el diseño una futura limpieza automática por job o mantenimiento programado.

---

## 10. Orden recomendado de implementación

1. migración Prisma con enums, tablas e índices;
2. `PromptRegistryService`;
3. `TokenAndCostService`;
4. `AIObservabilityService`;
5. helpers de redacción;
6. instrumentación del análisis de artículo en Verity;
7. endpoints admin mínimos;
8. documentación técnica breve de Fase 1.

Este orden reduce riesgo y entrega valor temprano.

---

## 11. Definition of Done — Fase 1

La Fase 1 se considera cerrada si:

- existen las tablas nuevas con sus índices;
- el enum común está implementado;
- el coste se guarda en micros de EUR;
- `requestId` y `correlationId` quedan registrados;
- hay política de redacción aplicada o centralizada;
- el análisis de artículo de Verity genera runs persistidos;
- existen endpoints admin mínimos para consultar overview y runs;
- el sistema actual no se rompe;
- la documentación técnica de la fase queda actualizada.

---

## 12. Riesgos técnicos ya identificados

- guardar contenido sensible sin redacción;
- estimaciones incorrectas de coste por cambios de pricing;
- sobrecarga de latencia si la telemetría se escribe de forma pesada;
- crecimiento de almacenamiento por granularidad run-level;
- inconsistencias entre Verity y MBA si se instrumentan con contratos distintos.

### Mitigación recomendada

- redacción desde Fase 1;
- catálogo de precios versionado;
- escritura ligera y simple;
- política de retención definida;
- contrato común de observabilidad.

---

## 13. Próximo entregable recomendado

### PR 1 — AI Observability Core

Debe incluir:

- migración Prisma;
- servicios comunes;
- redacción básica;
- primera integración en análisis de artículo de Verity;
- endpoints admin mínimos;
- documentación técnica de la fase.

Ese PR ya deja valor real, reduce incertidumbre y prepara bien Fase 2.

---

## 14. Estado real de ejecucion (actualizado a 2026-03-22)

### 14.1 Fase 1 completada en el repositorio

Se ha implementado el nucleo backend comun de observabilidad IA en `backend` (Verity) con primera integracion real en analisis de articulo.

Implementado:

- enum comun `AiRunStatus` con `PENDING`, `COMPLETED`, `FAILED`, `TIMEOUT`, `CANCELLED`;
- tablas Prisma:
  - `ai_prompt_versions`
  - `ai_model_pricing`
  - `ai_operation_runs`
- indices iniciales definidos desde la primera migracion;
- servicios:
  - `PromptRegistryService`
  - `TokenAndCostService`
  - `AIObservabilityService`
- instrumentacion real en flujo `article_analysis` de Verity;
- endpoints admin internos:
  - `GET /api/admin/ai-usage/overview`
  - `GET /api/admin/ai-usage/runs`
- redaccion centralizada de payloads sensibles;
- base preparada para retencion:
  - runs: 180 dias
  - debug payload: 30 dias

### 14.2 Pendiente para Media Bias Atlas (siguiente fase)

Todavia no esta instrumentado el flujo IA de MBA con la nueva capa persistente. Queda como siguiente tramo:

- `GeminiArticleBiasAIProvider`;
- `OpenAICompatibleArticleBiasAIProvider`;
- persistencia de `provider`, `model`, `tokens`, `estimatedCostMicrosEur`, `latencyMs`, `promptVersion`, `status/error`.

### 14.3 Nota operativa de migraciones

La migracion de observabilidad ya esta creada en codigo, pero su aplicacion local depende de tener PostgreSQL accesible en el entorno de ejecucion.

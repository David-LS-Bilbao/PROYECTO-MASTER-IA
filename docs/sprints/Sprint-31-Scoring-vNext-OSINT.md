# Sprint 31 - Scoring vNext OSINT (2026-02-13)

## Resumen
Se implementó una evolución del sistema de análisis IA para separar sesgo textual de verificación factual y alinear los scores con un marco OSINT basado en evidencia interna del artículo.

## Objetivo del Sprint
- Mantener `biasRaw` en rango `-10..+10`.
- Exponer `biasScoreNormalized = abs(biasRaw)/10` para UI.
- Redefinir `reliabilityScore` como fiabilidad por evidencia interna del texto.
- Añadir `traceabilityScore`, `factualityStatus`, `evidence_needed`, `should_escalate`.
- Endurecer prompt contra inyección y evitar mutaciones destructivas del contenido.
- Añadir calibración mínima con few-shot y cobertura de tests.

## Problemas resueltos
- `reliabilityScore` ya no se interpreta como “verdad externa”.
- Se eliminó la sanitización agresiva que reemplazaba `{}` por `()`.
- Se incorporó calibración de score con dos ejemplos guía y heurísticas internas.

## Cambios implementados

### 1) Prompt de análisis vNext
- Nuevo prompt con separación explícita:
  - `ANALISIS TEXTUAL`
  - `VERIFICACION FACTUAL`
- Prohibición explícita de inferir hechos externos.
- Respuesta JSON estricta.
- Delimitación del artículo con `<ARTICLE>...</ARTICLE>`.
- Dos few-shot de calibración (clickbait vs artículo bien citado).
- Variante de bajo coste para reducir tokens cuando se prioriza eficiencia.

Archivo:
- `backend/src/infrastructure/external/prompts/analysis.prompt.ts`
- `backend/src/infrastructure/external/prompts/index.ts`

### 2) Parser robusto con Zod
- Nuevo schema Zod para validar y normalizar payload de salida.
- Soporte de compatibilidad con campos legacy.
- Parseo de nuevos campos:
  - `biasScoreNormalized`
  - `traceabilityScore`
  - `factualityStatus`
  - `evidence_needed`
  - `should_escalate`

Archivo:
- `backend/src/infrastructure/external/schemas/analysis-response.schema.ts`

### 3) GeminiClient: seguridad, parseo y calibración
- `sanitizeInput()` actualizado para:
  - no alterar llaves `{}`
  - neutralizar patrones típicos de prompt injection
  - escapar delimitadores `<ARTICLE>` inyectados en contenido
- `parseAnalysisResponse()` migrado a schema Zod.
- Calibración heurística de `reliabilityScore` y `traceabilityScore` usando señales internas:
  - atribuciones
  - enlaces
  - citas
  - cifras contextualizadas
  - vaguedad/clickbait
- Cálculo de `should_escalate` por riesgo alto o baja trazabilidad con claims fuertes.

Archivo:
- `backend/src/infrastructure/external/gemini.client.ts`

### 4) Dominio y caso de uso
- Contrato `ArticleAnalysis` ampliado con campos vNext.
- Persistencia de `biasScore` en entidad usando valor normalizado (`biasScoreNormalized`).
- Normalización defensiva en `AnalyzeArticleUseCase` para caché legacy y salidas consistentes.

Archivos:
- `backend/src/domain/entities/news-article.entity.ts`
- `backend/src/application/use-cases/analyze-article.usecase.ts`

### 5) Tipado frontend (compatibilidad)
- Se extendió `ArticleAnalysis` en frontend con campos vNext en modo opcional para no romper fixtures existentes.

Archivo:
- `frontend/lib/api.ts`

### 6) Documentación técnica
- Documento funcional del modelo de scoring vNext.

Archivo:
- `docs/SCORING_VNEXT.md`

## Tests añadidos/actualizados
- Unit test Zod del parser nuevo.
- Test del prompt vNext (estructura y few-shot).
- Regresión del parser con dos textos:
  - clickbait sin soporte
  - artículo con trazabilidad interna alta
- Test de sanitización no destructiva.

Archivos:
- `backend/tests/infrastructure/external/analysis-response.schema.spec.ts`
- `backend/tests/infrastructure/external/prompts/analysis.prompt.spec.ts`
- `backend/tests/infrastructure/external/gemini.client.parse.spec.ts`
- `backend/tests/infrastructure/external/gemini.client.retry.spec.ts`
- `backend/tests/application/analyze-article.usecase.spec.ts`
- `backend/src/application/use-cases/analyze-article.usecase.spec.ts`

## Verificación ejecutada
- `npx vitest run tests/infrastructure/external/analysis-response.schema.spec.ts tests/infrastructure/external/gemini.client.parse.spec.ts tests/infrastructure/external/prompts/analysis.prompt.spec.ts`
- `npx vitest run tests/application/analyze-article.usecase.spec.ts src/application/use-cases/analyze-article.usecase.spec.ts tests/infrastructure/external/gemini.client.retry.spec.ts`
- `npx vitest run src/infrastructure/external/gemini.client.spec.ts tests/infrastructure/external/gemini.client.parse.spec.ts tests/infrastructure/external/gemini.client.retry.spec.ts tests/infrastructure/external/prompts/analysis.prompt.spec.ts tests/infrastructure/external/analysis-response.schema.spec.ts`
- `npm run typecheck` (backend)

Resultado: OK en el alcance de backend analítico y pruebas de regresión del cliente Gemini.

## Impacto de coste IA
- Se mantiene caché global de análisis para evitar llamadas duplicadas.
- Se añade `ANALYSIS_PROMPT_LOW_COST` para escenarios de optimización de tokens.
- No se introdujeron llamadas IA en bucles de render/UI.

## Riesgos y pendientes
- Existen cambios no relacionados en el working tree fuera de este sprint (archivos de `docs/diagrams` eliminados previamente). No forman parte de esta entrega funcional.
- Recomendado: monitorizar distribución real de `reliabilityScore`/`traceabilityScore` en producción durante 3-7 días para recalibrar umbrales si procede.

## Entregable
- Sistema de análisis IA actualizado a `Scoring vNext` con validación, calibración, hardening de prompt-injection, tests y documentación técnica.

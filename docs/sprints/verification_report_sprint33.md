# Sprint 33 Verification Report

## 1) Resumen Ejecutivo
Se corrigieron cuatro problemas principales del análisis en Verity News con cambios mínimos y compatibles:

1. `summary` low-quality ya no incluye avisos operativos ni plantillas legacy; el aviso se separa en `analysis.qualityNotice` (opcional).
2. La UI de sesgo evita estados engañosos (`Muy Neutral 0%`) y muestra:
   - `Neutral (confianza baja)` + `N/A` cuando corresponde.
   - `Indeterminada` + `N/A` para calidad baja (`<300`, snippet/paywall/notice).
3. Se alineó `reliabilityScore` con `factCheck.verdict` para evitar contradicciones score/etiqueta.
4. Se reforzó la tolerancia a mojibake (incluyendo sanitización de salida y decode de entidades HTML correcto) y se agregó test anti-`Ã`.

No se rompió contrato público. `qualityNotice` es opcional y compatible.

## 2) Cambios Por Archivo
### Commits
- `62753bb` `fix(summary,bias,reliability): clean low-quality summaries, add qualityNotice, align UI and UTF-8 safeguards`
- `2bd6b0d` `Polish quality notice display and bias wording`
- `e95e14f` `Refine preliminary warning conditions in news detail UI`

### Backend
- `backend/src/application/use-cases/analyze-article.usecase.ts`
  - `summary` limpio en low-quality (sin prefijos/avisos embebidos).
  - `qualityNotice` opcional separado.
  - reglas de limpieza para frases prohibidas en `summary`.
  - alineación de `reliabilityScore` por `factCheck.verdict`.
  - saneado anti-mojibake en payload de análisis.
  - corrección de decode HTML entities (`&aacute;`, etc.) con mapeo correcto.
- `backend/src/domain/entities/news-article.entity.ts`
  - agregado `qualityNotice?: string` en `ArticleAnalysis` (opcional).
- `backend/src/infrastructure/external/gemini.client.ts`
  - fallback de resumen sin appending de `Falta el texto completo...`.
- `backend/src/infrastructure/external/prompts/analysis.prompt.ts`
  - reglas editoriales actualizadas para prohibir plantillas fijas en `summary`.
- `backend/src/infrastructure/http/controllers/analyze.controller.ts`
  - `Content-Type` explícito con `application/json; charset=utf-8`.
- `backend/src/infrastructure/http/controllers/news.controller.ts`
  - sanitización recursiva anti-mojibake al serializar payload HTTP.
- `backend/src/application/use-cases/analyze-article.usecase.spec.ts`
  - tests nuevos/actualizados: summary limpio + `qualityNotice`, rangos reliability, anti-mojibake.
- `backend/tests/infrastructure/external/gemini.client.parse.spec.ts`
  - assert adicional: fallback summary sin aviso legacy.
- `backend/tests/infrastructure/external/prompts/analysis.prompt.spec.ts`
  - asserts actualizados de reglas editoriales.
- `backend/tests/integration/analyze.controller.spec.ts`
  - validación de `charset=utf-8` en Content-Type.

### Frontend
- `frontend/lib/api.ts`
  - agregado `qualityNotice?: string` en tipo `ArticleAnalysis` (opcional).
- `frontend/lib/news-utils.ts`
  - `getBiasInfo` deja de usar etiqueta `Muy Neutral` en banda baja.
  - nuevo `getBiasDisplayInfo` para mapping de sesgo con reglas de confianza/calidad.
- `frontend/lib/news-utils.spec.ts`
  - tests de mapping de sesgo UI (`Neutral (confianza baja)`, `Indeterminada`, `N/A`).
- `frontend/app/news/[id]/page.tsx`
  - render de `qualityNotice` separado del `summary`.
  - lectura de aviso desde `article.analysis?.qualityNotice` (una sola fuente).
  - aviso preliminar fallback solo si no hay `qualityNotice` y se cumple:
    `contentLength < 300` o leaning `indeterminada` o `analysisModeUsed=low_cost` con `contentLength < 800`.
  - uso de `getBiasDisplayInfo`.
  - `Puntuacion` en `N/A` cuando aplica (en lugar de `0%` engañoso).
- `frontend/components/reliability-badge.tsx`
  - texto de etiqueta soportada normalizado.
- `frontend/tests/components/reliability-badge.spec.tsx`
  - assert actualizado para la etiqueta.

## 3) Tabla De Reglas Finales
### Summary + qualityNotice
| Input | Output `summary` | Output `qualityNotice` |
|---|---|---|
| `scrapedContentLength >= 300` y contenido suficiente | 3-5 frases, máximo 90 palabras, sin frases prohibidas | `undefined` |
| `snippet_rss` / `paywall_o_vacio` / `<300` | 1-2 frases, máximo 45 palabras, limpio (sin aviso legacy) | `"Falta el texto completo para confirmar detalles."` |
| cached legacy (`Resumen provisional...`) | se limpia en respuesta y/o se regenera según regla existente | según calidad detectada |

### Bias display (UI)
| Condición | Label | Score UI |
|---|---|---|
| `contentLength < 300` o `qualityNotice` presente o leaning `indeterminada` | `Indeterminada` | `N/A` |
| leaning `neutral` + `leaningConfidence = baja` o `<2` indicadores | `Neutral (confianza baja)` | `N/A` |
| resto | mapping normal por score | `%` visible |

### Reliability por verdict
| Verdict / estado | Score final |
|---|---|
| `SupportedByArticle` | clamp a rango medio `45..65` |
| `InsufficientEvidenceInArticle` o `no_determinable` o low-quality | clamp `20..45` |
| otros casos | clamp conservador `20..60` |

## 4) Evidencias
### Logs de tests
```bash
# Backend (relevantes)
npx vitest run src/application/use-cases/analyze-article.usecase.spec.ts \
  tests/infrastructure/external/prompts/analysis.prompt.spec.ts \
  tests/infrastructure/external/analysis-response.schema.spec.ts \
  tests/infrastructure/external/gemini.client.parse.spec.ts \
  tests/integration/analyze.controller.spec.ts
# Resultado: PASS
```

```bash
# Frontend (relevantes)
npx vitest run lib/news-utils.spec.ts tests/components/reliability-badge.spec.tsx
# Resultado: 2 files passed, 25 tests passed
```

```bash
# Typecheck
backend: npm run typecheck
frontend: npx tsc --noEmit
# Resultado: PASS en ambos
```

### JSON Ejemplo 1 (Summary low-quality)
#### Antes
```json
{
  "summary": "El extracto afirma cambios en la negociación. Falta el texto completo para confirmar detalles.",
  "analysis": {
    "summary": "El extracto afirma cambios en la negociación. Falta el texto completo para confirmar detalles."
  }
}
```

#### Después
```json
{
  "summary": "El extracto afirma cambios en la negociación y menciona una cifra preliminar sin detallar alcance ni metodología.",
  "analysis": {
    "summary": "El extracto afirma cambios en la negociación y menciona una cifra preliminar sin detallar alcance ni metodología.",
    "qualityNotice": "Falta el texto completo para confirmar detalles."
  }
}
```

### JSON Ejemplo 2 (Reliability coherente)
#### Antes
```json
{
  "analysis": {
    "factCheck": { "verdict": "SupportedByArticle" },
    "reliabilityScore": 84,
    "reliabilityComment": "No verificable con fuentes internas."
  }
}
```

#### Después
```json
{
  "analysis": {
    "factCheck": { "verdict": "SupportedByArticle" },
    "reliabilityScore": 62,
    "reliabilityComment": "Fiabilidad media: soportado por el articulo con evidencia interna trazable; sin verificacion externa independiente."
  }
}
```

## 5) Checklist De Aceptación
| Criterio | Estado |
|---|---|
| Summary low-quality limpio (sin frases prohibidas) | OK |
| Aviso separado en `qualityNotice` | OK |
| Sesgo UI evita `Muy Neutral 0%` en baja confianza | OK |
| `Indeterminada + N/A` para baja calidad | OK |
| Reliability score coherente con verdict | OK |
| Header JSON con `charset=utf-8` | OK |
| Test anti-mojibake (`Ã`) | OK |
| Tests relevantes (backend/frontend) ejecutados | OK |
| Typecheck ejecutado | OK |

## Verificación Manual Recomendada (Producción)
1. Artículo largo (`scrapedContentLength > 1200`):
   - Esperado: `summary` en 3-5 frases, directo, sin plantillas.
   - Esperado: sin `qualityNotice`.
2. Snippet RSS o cuerpo incompleto:
   - Esperado: `summary` corto (1-2 frases) y limpio.
   - Esperado: `analysis.qualityNotice = "Falta el texto completo para confirmar detalles."`.
   - Esperado en UI sesgo: `Indeterminada` y `Puntuacion: N/A`.

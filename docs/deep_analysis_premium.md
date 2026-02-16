# Deep Analysis Premium - Implementation Report

## Scope
Branch: `feat/premium-deep-analysis`
Goal: remove `Re-analizar` from `/news/[id]` and ship a real premium `Analisis profundo` flow with backend gating, deep mode output, and UI rendering.

## What changed

### Backend
- Added optional request param `mode: "standard" | "deep"` in `POST /api/analyze/article` schema.
  - File: `backend/src/infrastructure/http/schemas/analyze.schema.ts`
- Added premium allowlist helper based on env var `PREMIUM_EMAILS`.
  - File: `backend/src/infrastructure/http/utils/premium-user.ts`
- Enforced deep-mode premium gating in controller.
  - `mode=deep` + non-premium user => `403` with `{ error: "Premium required" }`.
  - File: `backend/src/infrastructure/http/controllers/analyze.controller.ts`
- Extended domain/contracts to support deep analysis output.
  - `analysisModeUsed` now includes `deep`.
  - Optional `analysis.deep.sections` added (`known`, `unknown`, `quotes`, `risks`).
  - Files:
    - `backend/src/domain/entities/news-article.entity.ts`
    - `backend/src/domain/services/gemini-client.interface.ts`
- Added deep analysis prompt and wired it into Gemini client.
  - New prompt: `ANALYSIS_PROMPT_DEEP`
  - Deep token budget increased (`maxOutputTokens=2200`).
  - Files:
    - `backend/src/infrastructure/external/prompts/analysis.prompt.ts`
    - `backend/src/infrastructure/external/prompts/index.ts`
    - `backend/src/infrastructure/external/gemini.client.ts`
- Extended parse/repair/schema limits for deep output:
  - up to 10 claims, up to 8 bias indicators
  - optional `deep.sections` in schema
  - Files:
    - `backend/src/infrastructure/external/schemas/analysis-response.schema.ts`
    - `backend/src/infrastructure/external/gemini.client.ts`
- Use case deep-mode behavior:
  - accepts `mode` input
  - preserves `analysisMode=deep`
  - deep requests force reanalysis if cached analysis has no deep sections
  - best-effort deep fallback sections generated if model output is partial
  - low-quality deep inputs include explicit limitation in `unknown`
  - File: `backend/src/application/use-cases/analyze-article.usecase.ts`

### Frontend
- Removed `Re-analizar` action from analyzed state in `/news/[id]`.
- Added premium deep button with lock/disabled state for free users.
- Added deep sections panel with:
  - `Que sabemos`
  - `Que no sabemos`
  - `Citas del articulo`
  - `Riesgos de interpretacion`
- Handles deep `403` gracefully with premium message (no page break).
- Added `mode` in analyze API call payload.
- Added optional types for `analysis.deep.sections`.
- Files:
  - `frontend/app/news/[id]/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/components/deep-analysis-button.tsx`
  - `frontend/components/deep-analysis-panel.tsx`

## Compatibility
- Existing API is backward compatible:
  - `mode` is optional and defaults to `standard`.
  - new deep payload fields are optional (`analysis.deep.sections`).
- No existing required response fields were removed.

## Premium allowlist config (MVP)
Set in backend env:

```env
PREMIUM_EMAILS="a@b.com,c@d.com"
```

Rules:
- Missing/empty email => non-premium.
- Comparison is case-insensitive.

## Cache behavior
Current strategy is mode-aware without changing public contracts:
- Standard requests continue using cached standard analysis.
- Deep requests:
  - reuse cache only if deep sections already exist
  - otherwise regenerate and persist deep-capable analysis

This provides practical `articleId + mode` behavior while preserving existing storage shape.

## Validation and evidence

### Commands executed

```bash
npx vitest run backend/tests/infrastructure/http/controllers/analyze.controller.spec.ts backend/tests/infrastructure/http/utils/premium-user.spec.ts backend/src/application/use-cases/analyze-article.usecase.spec.ts backend/tests/infrastructure/external/prompts/analysis.prompt.spec.ts backend/tests/infrastructure/external/analysis-response.schema.spec.ts backend/src/infrastructure/external/gemini.client.spec.ts
```

Result:
- Test files: 6 passed
- Tests: 109 passed

```bash
cd frontend
npx vitest run tests/components/deep-analysis-button.spec.tsx tests/components/deep-analysis-panel.spec.tsx
```

Result:
- Test files: 2 passed
- Tests: 3 passed

```bash
cd backend
npm run typecheck
```

Result:
- PASS (`tsc --noEmit`)

```bash
cd frontend
npx tsc --noEmit
```

Result:
- PASS

## Key tests added/updated

### Backend
- `backend/tests/infrastructure/http/controllers/analyze.controller.spec.ts`
  - deep + free => `403 Premium required`
  - deep + premium => `200` and deep sections arrays
- `backend/tests/infrastructure/http/utils/premium-user.spec.ts`
  - allowlist and case-insensitive matching
- `backend/src/application/use-cases/analyze-article.usecase.spec.ts`
  - deep mode preserved for deep requests
  - deep sections returned
  - low-quality deep input includes limitation in `unknown`
- `backend/tests/infrastructure/external/analysis-response.schema.spec.ts`
  - deep sections schema acceptance
- `backend/tests/infrastructure/external/prompts/analysis.prompt.spec.ts`
  - deep prompt coverage

### Frontend
- `frontend/tests/components/deep-analysis-button.spec.tsx`
  - button disabled for free, enabled for premium
- `frontend/tests/components/deep-analysis-panel.spec.tsx`
  - renders deep sections correctly

## Example API behavior

### 1) Free user requesting deep
Request body:

```json
{ "articleId": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "mode": "deep" }
```

Response:

```json
{ "success": false, "error": "Premium required", "message": "Disponible en Premium" }
```

### 2) Premium user deep response fragment

```json
{
  "success": true,
  "data": {
    "analysis": {
      "summary": "...",
      "deep": {
        "sections": {
          "known": ["..."],
          "unknown": ["..."],
          "quotes": ["\"...\""],
          "risks": ["..."]
        }
      }
    }
  }
}
```

## Manual QA checklist
- Open `/news/[id]` for analyzed article:
  - `Re-analizar` button is not present.
- Free user:
  - `Analisis profundo` action appears disabled with lock/tooltip.
  - click or deep attempt returns premium message, UI remains stable.
- Premium user (email in `PREMIUM_EMAILS`):
  - deep analyze succeeds.
  - panel renders all available sections.
- Low-quality content (snippet/paywall):
  - deep response still returns `200` for premium.
  - `unknown` includes explicit limitation note.

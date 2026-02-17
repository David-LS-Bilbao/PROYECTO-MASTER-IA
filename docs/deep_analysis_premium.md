# Deep Analysis Premium - Entitlements + Promo Codes

## Scope
Branch: `feat/premium-deep-analysis`

Goal delivered in this iteration:
- Keep `Analisis profundo` as a premium feature.
- Unlock premium access for testing via promo code.
- Move gating to **entitlements** so payment integration can be swapped later without changing UI or analyze contracts.

## Architecture

### 1) Entitlements model
Source of truth is the authenticated user profile, exposed as:

```json
{
  "entitlements": {
    "deepAnalysis": false
  }
}
```

Current persistence:
- `deepAnalysis` is stored inside user preferences (`preferences.entitlements.deepAnalysis`).
- API always exposes it as top-level `entitlements.deepAnalysis` in `/api/user/me` and `/api/entitlements`.

Why this is stable for future billing:
- UI and backend gating consume only `entitlements.deepAnalysis`.
- Payment provider later only needs to update entitlement state (same contract), no UI/backend API rewrite.

### 2) Promo redeem flow
- Endpoint: `POST /api/entitlements/redeem`
- Body: `{ "code": "..." }`
- Validation source: `PROMO_CODES` (CSV env)
- If code is valid:
  - set `entitlements.deepAnalysis = true` for current user
  - return updated entitlements

### 3) Deep analysis gating
- Endpoint reused: `POST /api/analyze/article`
- Request body keeps `mode: "standard" | "deep"`
- Rule:
  - `mode=deep` + `entitlements.deepAnalysis=false` => `403`
  - `mode=deep` + entitlement true => deep analysis runs and returns `analysis.deep.sections`

Cache behavior remains mode-aware (existing implementation):
- deep requests reuse cache if deep sections already exist
- deep requests regenerate when deep sections are missing

## Backend changes

### New endpoints
- `GET /api/entitlements`
- `POST /api/entitlements/redeem`

Files:
- `backend/src/infrastructure/http/controllers/entitlements.controller.ts`
- `backend/src/infrastructure/http/routes/entitlements.routes.ts`
- `backend/src/infrastructure/http/schemas/entitlements.schema.ts`
- `backend/src/infrastructure/http/server.ts`
- `backend/src/infrastructure/config/dependencies.ts`

### User profile and auth enrichment
- Added entitlements parsing/safe defaults in user schemas.
- `req.user` now carries `entitlements` (optional, normalized).
- `/api/user/me` now returns top-level `entitlements`.

Files:
- `backend/src/infrastructure/http/schemas/user-profile.schema.ts`
- `backend/src/infrastructure/http/middleware/auth.middleware.ts`
- `backend/src/infrastructure/http/controllers/user.controller.ts`

### Analyze gating update
- Replaced email allowlist gating with entitlement gating.

File:
- `backend/src/infrastructure/http/controllers/analyze.controller.ts`

## Frontend changes

### Entitlements hook and API
- Added `useEntitlements` hook for read/redeem/refetch lifecycle.
- Added API wrapper for:
  - `GET /api/entitlements`
  - `POST /api/entitlements/redeem`

Files:
- `frontend/hooks/useEntitlements.ts`
- `frontend/lib/entitlements.api.ts`
- `frontend/lib/api.ts` (profile type includes `entitlements`)

### News detail deep-analysis UX
- `Re-analizar` remains removed.
- Deep button now uses `entitlements.deepAnalysis`.
- Without entitlement:
  - deep button disabled (`Disponible en Premium`)
  - CTA shown: `Activar con codigo`
  - CTA opens redeem modal/sheet
- After redeem success:
  - entitlements state updates
  - deep button becomes enabled

Files:
- `frontend/app/news/[id]/page.tsx`
- `frontend/components/deep-analysis-button.tsx`
- `frontend/components/deep-analysis-redeem-sheet.tsx`
- `frontend/components/deep-analysis-panel.tsx`

## API examples

### GET entitlements
```json
{
  "success": true,
  "data": {
    "entitlements": {
      "deepAnalysis": false
    }
  }
}
```

### Redeem success
```json
{
  "success": true,
  "data": {
    "entitlements": {
      "deepAnalysis": true
    }
  },
  "message": "Entitlements updated"
}
```

### Deep blocked (no entitlement)
```json
{
  "success": false,
  "error": "Deep analysis entitlement required",
  "message": "Activa Analisis profundo con un codigo promocional"
}
```

### Deep response fragment (enabled)
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

## Env configuration
```env
PROMO_CODES="VERITY_DEEP,MASTER_AI_2026"
```

## Validation executed

### Backend tests
```bash
npx vitest run backend/tests/infrastructure/http/controllers/entitlements.controller.spec.ts backend/tests/infrastructure/http/controllers/analyze.controller.spec.ts backend/tests/infrastructure/http/controllers/user.controller.spec.ts
```
Result:
- Test files: 3 passed
- Tests: 19 passed

### Frontend tests
```bash
cd frontend
npx vitest run tests/components/deep-analysis-button.spec.tsx tests/components/deep-analysis-panel.spec.tsx tests/components/deep-analysis-redeem-sheet.spec.tsx tests/hooks/useEntitlements.spec.ts
```
Result:
- Test files: 4 passed
- Tests: 7 passed

### Typecheck
```bash
cd backend
npm run typecheck
```
PASS

```bash
cd frontend
npx tsc --noEmit
```
PASS

## Payment integration path (no contract break)
When replacing promo codes with billing:
1. Keep `GET /api/entitlements` response shape unchanged.
2. Replace internals of `POST /api/entitlements/redeem` (or add billing webhooks) to set entitlements.
3. Keep analyze gating on `entitlements.deepAnalysis` exactly as-is.

This preserves frontend behavior and analyze API contract.

# Feature Notes - Paywall + Jina + JSON Repair

## Resumen

Este documento describe el estado real del pipeline de analisis en la rama actual:

- Extraccion de texto con Jina (incluyendo payload anidado `data.content`).
- Limpieza defensiva de contenido antes del LLM.
- Deteccion y bloqueo duro de articulos paywalled/restringidos.
- Parseo JSON estricto de Gemini con 1 intento de JSON repair.
- Manejo UI de `PAYWALL_BLOCKED` y `formatError`.

## Decisiones clave

- **Bloqueo duro de paywall**: no se intenta bypass ni analisis parcial para contenido restringido.
- **JSON repair de 1 intento**: mejora resiliencia sin entrar en reintentos indefinidos.
- **Fallback seguro de summary**: si parse/repair falla, no se renderiza JSON crudo en UI.
- **Deep sin contaminacion**: cuando hay `formatError`, se ocultan secciones deep.

## Flujo real de analisis (standard/deep)

### 1) Entrada y gate inicial
- Endpoint: `POST /api/analyze/article`.
- Use case: `backend/src/application/use-cases/analyze-article.usecase.ts`.
- Gate temprano:
  - si `article.analysisBlocked === true` o `accessStatus` en `PAYWALLED|RESTRICTED` => `422 PAYWALL_BLOCKED`.
  - este gate ocurre antes de servir cache, por lo que bloquea tambien cache legacy.

### 2) Seleccion de texto (que se analiza)
- Fuente inicial: `article.content` (DB).
- Se fuerza extraccion Jina cuando:
  - no hay contenido,
  - contenido < 100 chars,
  - contiene error previo de extractor,
  - modo deep con contenido < 800 chars o snippet RSS detectado.
- Cliente extractor: `backend/src/infrastructure/external/jina-reader.client.ts`.
  - Soporta payload plano y anidado (`data.content`, `data.text`, etc.).
  - Extrae flags de metadata (`isSubscriberContent`/`isSuscriberContent`).
- Fallback si falla Jina: `title + description` (snippet).

### 3) Limpieza previa al LLM
- Funcion central: `prepareContentForAnalysis(...)` en `AnalyzeArticleUseCase`.
- Reglas de limpieza:
  - intenta extraer texto de blobs JSON (`content`, `text`, `data.content`, etc.),
  - decodifica escapes unicode (`\\uXXXX`) y entidades HTML,
  - strip de HTML/anchors,
  - elimina ruido interno (IDs tipo `_0`, flags internas, metadata keys),
  - normaliza espacios y puntuacion.

### 4) Señales de calidad para prompt
- Se calculan y se envian al cliente Gemini:
  - `inputQuality`: `full | snippet_rss | paywall_o_vacio | unknown`
  - `textSource`: `db_content | extracted_jina | fallback_snippet | rss_snippet | unknown`
  - `contentChars`.

### 5) Seleccion de prompt (moderate/deep/low_cost)
- Cliente: `backend/src/infrastructure/external/gemini.client.ts`.
- Selector:
  - `deep` => `ANALYSIS_PROMPT_DEEP`
  - `moderate` => `ANALYSIS_PROMPT_MODERATE`
  - `standard` => `ANALYSIS_PROMPT`
  - `low_cost` => `ANALYSIS_PROMPT_LOW_COST`
- Si contenido es corto/incompleto, puede degradar a `low_cost`.

### 6) Parseo y JSON repair
- Parse JSON estricto.
- Si parse falla:
  - 1 intento con `JSON_REPAIR_PROMPT`.
  - si repair no recupera payload valido, fallback:
    - `summary = "No se pudo procesar el formato del analisis. Reintenta."`
    - `formatError = true`.

### 7) Normalizacion y salida UI
- Si `formatError=true`:
  - backend no entrega deep synthetic,
  - frontend muestra estado de error y evita render de secciones deep.

## Paywall: deteccion y bloqueo

### Detector
- Implementacion: `backend/src/application/services/paywall-detector.ts`.
- Señales:
  - fuerte: metadata subscriber flag true.
  - fuerte: keywords de suscripcion en texto.
  - media: extractor vacio/fallo + snippet corto + dominio probable paywall.

### Persistencia
- Prisma `Article`:
  - `accessStatus` (`PUBLIC|PAYWALLED|RESTRICTED|UNKNOWN`)
  - `accessReason`
  - `analysisBlocked` (boolean)

### Contrato de error
- Error de dominio: `PaywallBlockedError`.
- Respuesta HTTP: `422`.
- Codigo: `PAYWALL_BLOCKED`.

## UX asociada

- Pantalla detalle (`frontend/app/news/[id]/page.tsx`):
  - si recibe `PAYWALL_BLOCKED`:
    - muestra mensaje claro al usuario,
    - no renderiza resultados parciales de analisis,
    - no intenta mostrar deep.
- Si `analysis.formatError=true`:
  - muestra estado de error de formato,
  - boton de reintento,
  - secciones deep ocultas.

## Scripts de auditoria local

Si estan presentes en `backend/scripts`:

```bash
cd backend
npx ts-node scripts/audit-article-text.ts --list
npx ts-node scripts/audit-article-text.ts --articleId <UUID> --mode deep
```

```bash
cd backend
npx ts-node scripts/run-analyze-deep-local.ts --articleId <UUID>
```

## Validacion recomendada (comandos reales)

```bash
cd backend
npm run typecheck
npx vitest run
npm run test:coverage
```

```bash
cd frontend
npx tsc --noEmit
npm run test:run
npm run test:e2e:smoke
```

## Tests relevantes (referencia)

- `backend/tests/application/analyze-article.mode-cache.spec.ts`
- `backend/tests/application/analyze-article.content-cleaning.spec.ts`
- `backend/tests/application/paywall-detector.spec.ts`
- `backend/tests/infrastructure/external/gemini.client.json-repair.spec.ts`
- `backend/tests/integration/analyze.controller.spec.ts`
- `frontend/tests/lib/analyze-api-errors.spec.ts`


# Memoria Tecnica TFM - Verity News

## Datos del proyecto
- Proyecto: Verity News
- Tipo: Trabajo Fin de Master (desarrollo con IA)
- Estado del documento: alineado al codigo del repositorio (actualizacion Febrero 2026)
- Repositorio: `PROYECTO-MASTER-IA/Verity-News`

---

## 1. Resumen ejecutivo
Verity News es una plataforma web para ingesta, consulta y analisis asistido de noticias.

La solucion combina:
- Ingesta de noticias desde RSS/fuentes agregadas.
- Analisis de contenido con LLM (Gemini) en modo estandar y profundo.
- Chat asistido con recuperacion semantica (RAG) sobre embeddings en PostgreSQL con pgvector.
- Control de acceso Premium/FREE, incluyendo entitlements por codigo promocional.
- Bloqueo duro de articulos de pago (paywall) para evitar analisis parcial engañoso.

El despliegue actual operativo usa:
- Frontend: Next.js (Vercel)
- Backend: Node.js + Express (Render)
- Datos: PostgreSQL + pgvector (Neon en produccion, Docker local)
- Auth: Firebase Auth + Firebase Admin
- Observabilidad: Sentry + logging estructurado

---

## 2. Objetivos del proyecto
Objetivo general:
- Construir una plataforma util para lectura critica de noticias, con IA y trazabilidad tecnica.

Objetivos especificos implementados:
- Ingesta y normalizacion de articulos.
- Persistencia de articulos, usuarios, favoritos, historial y chats.
- Analisis estructurado con IA (incluye modo deep/premium).
- Chat contextual con recuperacion semantica.
- Control de acceso por plan y entitlements.
- Calidad de software con tests unitarios, integracion y E2E smoke.

---

## 3. Alcance y no alcance
Incluido en el alcance actual:
- Aplicacion full-stack en produccion.
- Pipeline de analisis con deteccion de calidad de entrada.
- Deteccion de paywall y bloqueo de analisis.
- Resiliencia de parseo JSON del LLM con 1 intento de repair.
- Comandos de QA reproducibles y gates de cobertura.

Fuera de alcance (MVP actual):
- Fact-checking humano exhaustivo.
- Bypass de paywalls o scraping agresivo.
- Billing real completo (el acceso premium actual convive con plan y entitlements).

---

## 4. Arquitectura vigente

### 4.1 Backend
Arquitectura por capas (domain/application/infrastructure/http) con DI container.

Piezas principales:
- `backend/src/application/use-cases/*.ts`
- `backend/src/domain/*`
- `backend/src/infrastructure/http/*`
- `backend/src/infrastructure/external/*`

### 4.2 Frontend
Aplicacion Next.js App Router con React Query, hooks de datos y componentes de UI.

Piezas principales:
- `frontend/app/*`
- `frontend/components/*`
- `frontend/hooks/*`
- `frontend/lib/*`

### 4.3 Persistencia y busqueda semantica
- Prisma ORM sobre PostgreSQL.
- Embeddings en columna `vector(768)` (pgvector).
- Cliente vectorial activo: `PgVectorClient`.

Nota de contexto:
- Existen referencias legacy a Chroma en comentarios/documentacion historica.
- El flujo activo en codigo usa pgvector.

---

## 5. Modelo de datos relevante

### 5.1 Usuario
En `schema.prisma`:
- `subscriptionPlan`: `FREE | PREMIUM`
- `preferences` y `usageStats` (JSON)
- Entitlements de feature (incluye `deepAnalysis`) se gestionan via perfil/preferencias parseadas de forma segura.

### 5.2 Articulo
Campos clave en `Article`:
- Texto y metadata: `title`, `description`, `content`, `url`, `source`, etc.
- IA: `summary`, `biasScore`, `analysis`, `analyzedAt`, `internalReasoning`.
- Acceso: `accessStatus` (`PUBLIC|PAYWALLED|RESTRICTED|UNKNOWN`), `accessReason`, `analysisBlocked`.
- Vector: `embedding` (`vector(768)`).

---

## 6. Flujo real de analisis

### 6.1 Endpoint y gating inicial
Endpoint principal:
- `POST /api/analyze/article`

Control de premium (antes de ejecutar deep):
- Si `mode=deep` y usuario no cumple Premium/entitlement -> `403` con `code=PREMIUM_REQUIRED` y mensaje `Solo para usuarios Premium`.

### 6.2 Gate de paywall (bloqueo duro)
En `AnalyzeArticleUseCase`:
- Si `article.analysisBlocked=true` o `accessStatus` en `PAYWALLED|RESTRICTED` -> `422 PAYWALL_BLOCKED`.
- Este gate se evalua antes de devolver cache, por lo que bloquea tambien analisis cacheados legacy.

### 6.3 Cache de analisis
- Si `article.isAnalyzed=true` y el cache es valido para el modo solicitado, se reutiliza resultado.
- Si se pide `deep` y el cache no tiene `deep.sections` completo, se fuerza regeneracion.
- Si el summary cacheado es legacy o invalido, se regenera.

### 6.4 Extraccion de texto completo (Jina)
Cliente:
- `backend/src/infrastructure/external/jina-reader.client.ts`

Comportamiento actual:
- Fuerza scraping cuando falta contenido, es corto, hay error previo o deep requiere mas cuerpo.
- Soporta payload plano y anidado (`data.content`, `data.text`, etc.).
- Si scraping falla, fallback a snippet (`title + description`).

### 6.5 Limpieza de contenido antes del LLM
En `prepareContentForAnalysis(...)`:
- Extraccion defensiva desde JSON (`content`, `text`, `data.content`, etc.).
- Decodificacion de escapes unicode y entidades HTML.
- Strip de HTML.
- Eliminacion de ruido interno (`isSubscriberContent`, `ids`, `*_0`, metadata interna).
- Normalizacion final de espacios y puntuacion.

### 6.6 Deteccion de calidad de entrada
Señales enviadas al cliente LLM:
- `inputQuality`: `full | snippet_rss | paywall_o_vacio | unknown`
- `textSource`: `db_content | extracted_jina | fallback_snippet | rss_snippet | unknown`
- `contentChars`

### 6.7 Seleccion de prompt por modo
En `gemini.client.ts`:
- `deep` -> `ANALYSIS_PROMPT_DEEP`
- `moderate` -> `ANALYSIS_PROMPT_MODERATE`
- `standard` -> `ANALYSIS_PROMPT`
- `low_cost` -> `ANALYSIS_PROMPT_LOW_COST`

### 6.8 Parseo JSON estricto + 1 intento de repair
Resiliencia implementada:
- Parse estricto de respuesta del modelo.
- Si falla, 1 intento con `JSON_REPAIR_PROMPT`.
- Si repair falla, fallback seguro:
  - summary: `No se pudo procesar el formato del analisis. Reintenta.`
  - `formatError=true`

### 6.9 Salida a UI y manejo de errores
- `PAYWALL_BLOCKED` (422): UI no muestra resultados parciales.
- `PREMIUM_REQUIRED` (403): UI muestra `Solo para usuarios Premium`.
- `formatError=true`: UI muestra estado de error de formato y evita contaminar secciones deep.

---

## 7. Chat IA y acceso premium
Regla de acceso alineada con deep analysis:
- Premium por plan (`subscriptionPlan=PREMIUM`) o por entitlement (`deepAnalysis=true`).

Si no cumple:
- API de chat responde `403` con codigo de feature/premium.
- Frontend muestra mensaje `Solo para usuarios Premium`.

---

## 8. Paywall y restricciones de contenido
Detector:
- `backend/src/application/services/paywall-detector.ts`

Señales activas:
- Fuerte: flag metadata de suscriptor (`isSubscriberContent` / `isSuscriberContent`).
- Fuerte: keywords de suscripcion en texto extraido/contenido.
- Media: extractor vacio o fallo + snippet corto + dominio probable de paywall.

Dominios probables incluyen (entre otros):
- `elpais.com`, `elmundo.es`, `expansion.com`, `abc.es`, `lavanguardia.com`.

Politica funcional:
- No se intenta bypass.
- Se bloquea analisis cuando no hay texto completo util.

---

## 9. Entitlements y promo codes
Endpoints:
- `GET /api/entitlements`
- `POST /api/entitlements/redeem`
- `GET /api/user/me`

Comportamiento:
- `GET /api/user/me` expone `entitlements.deepAnalysis` con parseo seguro.
- `GET /api/entitlements` devuelve `data.entitlements`.
- `POST /api/entitlements/redeem` valida `PROMO_CODES` (CSV en entorno) y persiste `deepAnalysis=true`.

---

## 10. Calidad y estrategia de testing
Referencia oficial de calidad:
- `docs/CALIDAD.md`

Gates base pre-merge:
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

Comando E2E completo (cuando aplica):
```bash
cd frontend
npm run test:e2e
```

Politica de cobertura:
- Branches global backend >= 80% (sin bajar umbrales).

---

## 11. Ejecucion local y despliegue

### 11.1 Local
- `docker compose up -d`
- PostgreSQL local: imagen `pgvector/pgvector:pg16`, puerto `5433`.
- `chromadb` puede seguir en compose por legado, pero el backend activo usa pgvector.

### 11.2 Produccion
Arquitectura operativa actual:
- Frontend en Vercel.
- Backend en Render.
- PostgreSQL + pgvector en Neon.

Runbook de incidentes y pre-merge:
- `docs/incidents/PRE_MERGE_PLAYBOOK_RENDER_PRISMA.md`

---

## 12. Riesgos tecnicos y deuda conocida
- Persisten referencias legacy a Chroma en comentarios o nombres de tests que no representan el runtime actual.
- Puede existir cache historico con estructuras antiguas de analisis; el pipeline actual incluye regeneracion y bloqueos defensivos.
- Recomendable mantener auditorias periodicas de `accessStatus/analysisBlocked` en articulos legacy.

---

## 13. Anexos

### Anexo A - Documentos tecnicos relacionados
- `README.md`
- `docs/ESTADO_PROYECTO.md`
- `docs/CALIDAD.md`
- `docs/FEATURE_PAYWALL_JINA_JSON_REPAIR.md`

Scripts tecnicos disponibles en `backend/scripts`:
- `audit-article-text.ts`
- `run-analyze-deep-local.ts`

### Anexo B - DevOps e infraestructura (vias futuras)
Este anexo se mantiene como hoja de ruta futura y no reemplaza la arquitectura de produccion vigente descrita en esta memoria.

Contenido de este anexo (CI/CD avanzado, topologias alternativas, hardening adicional, etc.) debe leerse como plan de evolucion.

### Anexo C - Suposiciones razonables
- El roadmap de evolucion de billing/pasarela de pago se considera plan futuro y no funcionalidad cerrada en el estado actual.
- El backfill masivo de articulos legacy para recalcular estados de acceso se considera recomendado, no completado al 100%.

# Informe Detallado de los 7 Sprints de Media Bias Atlas

Fecha: 2026-03-17

## 1. Alcance de este informe

Este documento resume la evolución de `media-bias-atlas` hasta el cierre de Sprint 7 y deja reflejados también los ajustes posteriores ya realizados sobre la integración IA.

Importante:

- el informe se centra exclusivamente en `media-bias-atlas`;
- no incluye cambios aplicados en `Verity News`;
- los sprints 5, 6 y 7 quedan respaldados por migraciones, tests, rutas, componentes y artefactos funcionales del repositorio;
- los sprints 1 a 4 se reconstruyen de forma razonada a partir del estado real del código y de la estructura acumulada del MVP.

## 2. Resumen ejecutivo

Tras siete sprints, `media-bias-atlas` ha quedado convertido en un MVP funcional con estas capacidades:

- catálogo de países;
- alta y consulta de medios por país;
- alta de feeds RSS por medio;
- sincronización manual y persistencia de artículos;
- clasificación política básica por artículo y por feed;
- análisis ideológico por artículo con persistencia robusta;
- visualización frontend del estado ideológico por artículo;
- resumen ideológico agregado básico por feed;
- provider IA desacoplado y ya alineado con el patrón Gemini del ecosistema técnico de Verity.

Estado actual:

- backend y frontend operativos hasta Sprint 7;
- Prisma y base de datos alineados;
- análisis ideológico visible desde la UI;
- soporte real para `gemini`, `openai-compatible` y `disabled`;
- condición operativa pendiente: activar `BIAS_AI_*` en `media-bias-atlas/backend/.env` para ejecutar análisis reales contra proveedor externo.

## 3. Línea temporal resumida

| Sprint | Foco principal | Resultado |
|---|---|---|
| 1 | Bootstrap técnico y modelo base | Proyecto levantado con backend, frontend y esquema inicial de países/medios/feeds |
| 2 | Catálogo de países y medios | APIs y UI para listar países, listar medios y crear medios |
| 3 | Gestión de feeds RSS | Alta de feeds, detalle de medio y acciones de feed en frontend |
| 4 | Ingesta y tracking de artículos | Persistencia de artículos, sincronización manual y visor de noticias |
| 5 | Clasificación política | Modelo, casos de uso, endpoints y UI para clasificar artículos políticos |
| 6 | Bias analysis por artículo | Persistencia de análisis ideológico, provider IA desacoplado y endpoints backend |
| 7 | Visualización y resumen ideológico | UI del feed con estados de sesgo, resumen agregado y acción de análisis |

## 4. Detalle por sprint

### Sprint 1. Bootstrap del producto y modelo de datos inicial

Objetivo:

- levantar una base técnica separada para `media-bias-atlas`, con backend y frontend propios.

Entregables realizados:

- backend Node.js + TypeScript + Express;
- Prisma y migración inicial `20260316190358_init`;
- tablas `countries`, `outlets` y `rss_feeds`;
- semilla inicial con 5 países;
- base de frontend Next.js con layout y página raíz.

Resultado:

- quedó montada la base técnica del producto y el modelo relacional mínimo para empezar el catálogo.

### Sprint 2. Catálogo de países y alta de medios

Objetivo:

- permitir navegar el catálogo base y dar de alta medios asociados a un país.

Entregables realizados:

- casos de uso para listar países, listar medios por país, obtener medio y crear medio;
- repositorios Prisma para países y medios;
- rutas `GET /api/countries`, `GET /api/countries/:code/outlets`, `GET /api/outlets/:id` y `POST /api/outlets`;
- páginas de países, medios por país y alta manual de medio;
- formulario `CreateOutletForm` con validación;
- tests base de caso de uso y formulario.

Resultado:

- el sistema ya permitía construir y navegar el catálogo inicial de medios.

### Sprint 3. Gestión de feeds RSS por medio

Objetivo:

- vincular medios con uno o varios feeds RSS para preparar la ingesta.

Entregables realizados:

- casos de uso para añadir y listar feeds por medio;
- repositorio Prisma de feeds;
- rutas `GET /api/outlets/:outletId/feeds` y `POST /api/outlets/:outletId/feeds`;
- detalle de medio, formulario de alta rápida de feeds y acciones por feed en frontend.

Resultado:

- quedó resuelta la gestión manual de feeds, base necesaria para ingerir artículos.

### Sprint 4. Ingesta de artículos y tracking de sincronización

Objetivo:

- pasar de feeds configurados a artículos persistidos y visibles.

Entregables realizados:

- migración `20260316205444_add_article_and_feed_tracking`;
- tabla `articles`, `last_checked_at` y unicidad por `url`;
- `SyncFeedArticlesUseCase` y `ListArticlesByFeedUseCase`;
- parseo RSS con deduplicación por URL;
- rutas `POST /api/feeds/:feedId/sync` y `GET /api/feeds/:feedId/articles`;
- visor de artículos del feed y sincronización manual desde UI.

Resultado:

- el producto dejó de ser un catálogo de feeds y pasó a almacenar noticias reales.

### Sprint 5. Clasificación política de artículos

Objetivo:

- separar qué artículos son políticos antes de analizar sesgo ideológico.

Entregables realizados:

- migración `20260317084910_sprint_5_political_classification`;
- campos `is_political`, `classification_status`, `classification_reason` y `classified_at` en `articles`;
- heurística por keywords;
- `ClassifyPoliticalArticleUseCase` y `ClassifyPoliticalFeedUseCase`;
- rutas `POST /api/articles/:articleId/classify-political` y `POST /api/feeds/:feedId/classify-political`;
- etiquetas y filtro visual en la vista del feed;
- ajuste posterior del test heurístico para alinearlo con el comportamiento real.

Resultado:

- quedó resuelto el filtro previo imprescindible para Sprint 6.

### Sprint 6. Análisis ideológico por artículo con IA

Objetivo:

- implementar análisis ideológico por artículo en backend, con JSON estricto, persistencia robusta y proveedor IA desacoplado.

Entregables realizados:

- migración `20260317115942_sprint_6_article_bias_analysis`;
- entidad `ArticleBiasAnalysis`;
- enums `BiasAnalysisStatus` e `IdeologyLabel`;
- parser fuerte `ArticleBiasJsonParser`;
- casos de uso `AnalyzeArticleBiasUseCase` y `AnalyzeFeedBiasUseCase`;
- repositorio Prisma para `article_bias_analysis`;
- providers `disabled` y `openai-compatible`;
- factory `createArticleBiasAIProvider`;
- rutas:
  - `POST /api/articles/:articleId/analyze-bias`
  - `GET /api/articles/:articleId/bias-analysis`
  - `POST /api/feeds/:feedId/analyze-bias`
- tests unitarios del parser y de los casos de uso.

Reglas de negocio cerradas en este sprint:

- solo analiza artículos con `isPolitical === true`;
- si no es político, no invoca IA;
- si ya existe `COMPLETED`, no rehace;
- si falla parseo o validación, persiste `FAILED`.

Resultado:

- Sprint 6 quedó cerrado en backend con comportamiento controlado y persistencia robusta.

### Sprint 7. Visualización de sesgo ideológico y resumen agregado básico

Objetivo:

- exponer en frontend el análisis ideológico persistido y añadir un resumen agregado simple por feed.

Entregables realizados:

Backend:

- caso de uso `GetFeedBiasSummaryUseCase`;
- endpoint `GET /api/feeds/:feedId/bias-summary`;
- listado de artículos enriquecido con `biasAnalysis`.

Frontend:

- vista del feed ampliada con estado ideológico por artículo;
- resumen ideológico por feed;
- botón `Analizar sesgo` desde UI;
- filtros mínimos por estado político, estado de análisis y etiqueta ideológica;
- manejo de estados vacíos y errores.

Testing y validación:

- test unitario de `GetFeedBiasSummaryUseCase`;
- test frontend de filtros de feed;
- `build` de frontend en verde;
- validación funcional real de la vista del feed y de los endpoints nuevos.

Resultado:

- Sprint 7 dejó visible la primera capa de valor del producto sobre Sprint 6: análisis ideológico consultable, resumible y usable desde la UI.

## 5. Estado acumulado tras los 7 sprints

### Funcionalidad disponible hoy

- países sembrados y consultables;
- medios registrables y navegables por país;
- feeds RSS asociables a cada medio;
- sincronización manual de feeds;
- persistencia de artículos deduplicados;
- clasificación política por artículo y por feed;
- análisis ideológico por artículo;
- consulta del análisis ideológico persistido;
- resumen ideológico básico por feed;
- visualización frontend del estado de sesgo por artículo;
- acción de análisis desde la UI del feed.

### Validación técnica comprobada

Backend:

- `npx prisma migrate status --schema prisma/schema.prisma` -> esquema al día;
- `npx prisma validate --schema prisma/schema.prisma` -> válido;
- `npx tsc --noEmit` -> correcto;
- `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run tests/unit` -> suite unitaria del backend en verde.

Frontend:

- `npx tsc --noEmit` -> correcto;
- `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run` -> tests del frontend en verde;
- `npm run build` -> correcto.

Base de datos:

- Sprint 5 aplicado;
- Sprint 6 aplicado;
- `article_bias_analysis` existente en DB.

Operatividad:

- con provider `disabled`, el sistema responde de forma controlada y persiste `FAILED`;
- con `BIAS_AI_*` configuradas, el código queda preparado para análisis real contra proveedor externo.

## 6. Actualización posterior: alineación IA con Verity News

Tras el cierre de Sprint 7 se hizo un ajuste puntual, ya implementado, para alinear `media-bias-atlas/backend` con el patrón IA real del ecosistema Verity News sin acoplar ambos productos.

Cambios realizados:

- auditoría del patrón IA real de Verity;
- confirmación de uso de Gemini mediante SDK oficial `@google/generative-ai`;
- incorporación de `GeminiArticleBiasAIProvider` en `media-bias-atlas`;
- soporte en factory para:
  - `BIAS_AI_PROVIDER=gemini`
  - `BIAS_AI_PROVIDER=openai-compatible`
  - `BIAS_AI_PROVIDER=disabled`
- modelo por defecto alineado con Verity: `gemini-2.5-flash`;
- prompt compartido entre providers;
- tests unitarios nuevos del provider Gemini y del factory.

Resultado:

- `media-bias-atlas` ya no depende solo de `openai-compatible`;
- el provider real recomendado queda alineado con Gemini;
- el diseño sigue desacoplado a través de `IArticleBiasAIProvider`.

## 7. Deuda técnica real tras Sprint 7

No son features nuevas. Son puntos pendientes o limitados:

1. No existe todavía agregación de sesgo a nivel de medio (`outlet-bias-profile`), aunque sí análisis por artículo y resumen por feed.
2. El análisis ideológico sigue usando principalmente titular y metadatos; no hay cuerpo completo ni scraping del artículo en este MVP.
3. No hay todavía pruebas HTTP automatizadas específicas para todos los endpoints de Sprint 6 y Sprint 7, aunque sí validación manual real y tests unitarios.
4. La activación operativa real sigue dependiendo de configurar `BIAS_AI_*` en entorno.
5. Persisten pequeñas inconsistencias menores de naming/UX heredadas entre clasificación política y análisis ideológico.

## 8. Conclusión

Los siete primeros sprints de `media-bias-atlas` han construido un MVP coherente y acumulativo:

- Sprint 1 levantó la base técnica y el modelo inicial.
- Sprint 2 resolvió el catálogo de países y medios.
- Sprint 3 habilitó la gestión manual de feeds.
- Sprint 4 convirtió feeds en artículos almacenados y visibles.
- Sprint 5 añadió clasificación política.
- Sprint 6 añadió análisis ideológico por artículo con persistencia robusta y proveedor IA desacoplado.
- Sprint 7 añadió la capa visible: resumen ideológico por feed, UI de sesgo y acción de análisis desde frontend.

Resultado global:

- el producto ya puede registrar países, medios y feeds;
- ya puede ingerir artículos y clasificarlos;
- ya puede persistir análisis ideológico por artículo;
- ya puede mostrar el estado de sesgo en frontend y resumirlo por feed;
- el backend y el frontend están técnicamente cerrados hasta Sprint 7;
- el provider IA ya está alineado con Gemini del ecosistema Verity sin acoplar productos;
- la única condición operativa restante para análisis real es activar las variables `BIAS_AI_*` en el entorno.

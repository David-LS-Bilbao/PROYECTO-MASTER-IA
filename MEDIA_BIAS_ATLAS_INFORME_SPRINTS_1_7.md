# Informe Detallado de la Evolución de Media Bias Atlas hasta Sprint 10

Fecha: 2026-03-18

Nota:

- este archivo conserva un nombre histórico (`...1_7.md`), pero su contenido ya refleja el estado real del producto hasta Sprint 10 y el bloque final de consolidación del MVP.

## 1. Alcance del informe

Este documento resume la evolución de `media-bias-atlas` desde su arranque hasta el cierre funcional del tramo actual del MVP.

Incluye:

- sprints 1 a 10;
- el ajuste posterior de alineación IA con Gemini;
- el cierre técnico ligero de consolidación final;
- el estado operativo actual del frontend, backend y base de datos.

No incluye:

- cambios de `Verity News`;
- sprints o entregas del producto principal ajenos a `media-bias-atlas`.

## 2. Resumen ejecutivo

`media-bias-atlas` ha evolucionado desde un catálogo básico de países y medios hasta un MVP navegable y demostrable que ya permite:

- registrar países, medios y feeds RSS;
- sincronizar artículos desde RSS;
- clasificar artículos políticos;
- analizar sesgo ideológico por artículo con persistencia robusta;
- resumir ideología por feed;
- calcular perfil ideológico por medio;
- visualizar resultados desde frontend;
- filtrar y ordenar medios;
- comparar dos outlets desde la navegación principal del atlas.

Estado actual:

- backend operativo y validado;
- frontend operativo y validado;
- Prisma alineado con la base de datos;
- soporte IA desacoplado con `disabled`, `gemini` y `openai-compatible`;
- salida controlada cuando PostgreSQL no está disponible;
- MVP listo para demo técnica;
- estructura de seeds manuales idempotentes preparada para `ES`, `GB`, `FR`, `DE` y `US`;
- lote de `Estados Unidos` ya cargado en base para demo local con outlets y feeds validados.

Condiciones operativas:

- PostgreSQL debe estar accesible para `media-bias-atlas/backend`;
- para análisis ideológico real hay que configurar `BIAS_AI_*` en `media-bias-atlas/backend/.env`.

## 3. Línea temporal resumida

| Sprint | Foco principal | Resultado |
|---|---|---|
| 1 | Bootstrap técnico y modelo base | Backend, frontend, Prisma y estructura inicial de países/medios/feeds |
| 2 | Catálogo de países y alta de medios | APIs y UI para listar países, listar medios y crear outlets |
| 3 | Gestión de feeds RSS | Alta/listado de feeds y detalle de medio |
| 4 | Ingesta y tracking de artículos | Sincronización manual, persistencia de artículos y visor de noticias |
| 5 | Clasificación política | Heurística, persistencia y UI para identificar artículos políticos |
| 6 | Bias analysis por artículo | Parser estricto, persistencia, casos de uso y endpoints backend |
| 7 | Visualización y resumen ideológico por feed | UI del feed, resumen ideológico y acción de análisis |
| 8 | Alineación operativa del provider IA | Integración Gemini real, factory desacoplado y documentación de entorno |
| 9 | Perfil ideológico por outlet | Cálculo, endpoint y visualización del bias profile por medio |
| 10 | Exploración avanzada del atlas | Resúmenes en listados, filtros, ordenación y comparativa entre outlets |
| Post Sprint 10 | Consolidación operativa | Saneamiento de clasificación histórica y seeds manuales reproducibles por país |

## 4. Detalle por sprint

### Sprint 1. Bootstrap del producto y modelo de datos inicial

Objetivo:

- levantar una base técnica separada para `media-bias-atlas`, con backend y frontend propios.

Entregables principales:

- backend Node.js + TypeScript + Express;
- Prisma y migración inicial `20260316190358_init`;
- tablas `countries`, `outlets` y `rss_feeds`;
- seed inicial con países;
- frontend Next.js con layout y página raíz.

Resultado:

- se establece la base técnica del producto y el modelo relacional mínimo.

### Sprint 2. Catálogo de países y alta de medios

Objetivo:

- permitir navegar el catálogo base y registrar medios por país.

Entregables principales:

- casos de uso para listar países, listar medios por país, obtener medio y crear medio;
- repositorios Prisma de países y medios;
- rutas `GET /api/countries`, `GET /api/countries/:code/outlets`, `GET /api/outlets/:id`, `POST /api/outlets`;
- pantallas para países, medios por país y creación de outlets.

Resultado:

- el sistema ya permite construir el catálogo inicial del atlas.

### Sprint 3. Gestión de feeds RSS por medio

Objetivo:

- asociar uno o varios feeds RSS a cada medio.

Entregables principales:

- casos de uso para añadir y listar feeds;
- repositorio Prisma de feeds;
- rutas `GET /api/outlets/:outletId/feeds` y `POST /api/outlets/:outletId/feeds`;
- detalle de medio y formulario de alta de feeds.

Resultado:

- queda lista la gestión manual de feeds, base de la ingesta.

### Sprint 4. Ingesta de artículos y tracking de sincronización

Objetivo:

- convertir feeds configurados en artículos persistidos y visibles.

Entregables principales:

- migración `20260316205444_add_article_and_feed_tracking`;
- tabla `articles`, tracking de `last_checked_at` y unicidad por `url`;
- `SyncFeedArticlesUseCase` y `ListArticlesByFeedUseCase`;
- parseo RSS con deduplicación;
- rutas `POST /api/feeds/:feedId/sync` y `GET /api/feeds/:feedId/articles`;
- visor de artículos y sincronización manual desde UI.

Resultado:

- `media-bias-atlas` pasa de gestionar feeds a almacenar noticias reales.

### Sprint 5. Clasificación política de artículos

Objetivo:

- identificar qué artículos son políticos antes del análisis ideológico.

Entregables principales:

- migración `20260317084910_sprint_5_political_classification`;
- campos `is_political`, `classification_status`, `classification_reason` y `classified_at`;
- heurística por keywords;
- `ClassifyPoliticalArticleUseCase` y `ClassifyPoliticalFeedUseCase`;
- rutas:
  - `POST /api/articles/:articleId/classify-political`
  - `POST /api/feeds/:feedId/classify-political`
- visualización y filtros mínimos en la vista del feed.

Resultado:

- queda resuelto el filtro de entrada imprescindible para el análisis ideológico.

### Sprint 6. Análisis ideológico por artículo con IA

Objetivo:

- implementar análisis ideológico por artículo en backend con JSON estricto y persistencia robusta.

Entregables principales:

- migración `20260317115942_sprint_6_article_bias_analysis`;
- entidad `ArticleBiasAnalysis`;
- enums `BiasAnalysisStatus` e `IdeologyLabel`;
- parser fuerte `ArticleBiasJsonParser`;
- repositorio Prisma para `article_bias_analysis`;
- `AnalyzeArticleBiasUseCase` y `AnalyzeFeedBiasUseCase`;
- providers `disabled` y `openai-compatible`;
- factory `createArticleBiasAIProvider`;
- endpoints:
  - `POST /api/articles/:articleId/analyze-bias`
  - `GET /api/articles/:articleId/bias-analysis`
  - `POST /api/feeds/:feedId/analyze-bias`

Reglas cerradas:

- solo analiza artículos con `isPolitical === true`;
- no invoca IA para artículos no políticos;
- no rehace análisis si ya existe `COMPLETED`;
- persiste `FAILED` si falla parseo o validación.

Resultado:

- Sprint 6 cierra el backend del análisis ideológico por artículo.

### Sprint 7. Visualización de sesgo ideológico y resumen básico por feed

Objetivo:

- exponer en frontend el análisis ideológico persistido y resumirlo por feed.

Entregables principales:

Backend:

- `GetFeedBiasSummaryUseCase`;
- endpoint `GET /api/feeds/:feedId/bias-summary`;
- listado de artículos enriquecido con `biasAnalysis`.

Frontend:

- visualización de estado ideológico por artículo;
- resumen ideológico del feed;
- botón `Analizar sesgo`;
- filtros por estado político, estado de análisis y etiqueta ideológica;
- estados vacíos y errores controlados.

Resultado:

- primera capa visible de valor construida sobre Sprint 6.

### Sprint 8. Alineación operativa del provider IA con Gemini

Objetivo:

- alinear el provider real de `media-bias-atlas` con el patrón IA del ecosistema Verity, manteniendo desacoplamiento.

Entregables principales:

- auditoría del patrón IA usado en Verity;
- soporte real para Gemini mediante SDK oficial;
- `GeminiArticleBiasAIProvider`;
- actualización del factory para soportar:
  - `disabled`
  - `gemini`
  - `openai-compatible`
- modelo por defecto alineado con Gemini;
- documentación de `BIAS_AI_*` en `.env.example`;
- tests unitarios del provider y del factory.

Resultado:

- el backend queda listo para usar Gemini como provider real sin acoplar productos.

### Sprint 9. Perfil ideológico por outlet

Objetivo:

- pasar del análisis por artículo/feed a un perfil ideológico agregado a nivel de medio.

#### Bloque 9.1

Entregables:

- entidad `OutletBiasProfile`;
- estadísticas agregadas por outlet en repositorio;
- `CalculateOutletBiasProfileUseCase`;
- tests unitarios del cálculo.

#### Bloque 9.2

Entregables:

- `OutletNotFoundError`;
- endpoint `GET /api/outlets/:outletId/bias-profile`;
- DTO limpio de respuesta;
- tests unitarios del controller;
- test de integración HTTP.

#### Bloque 9.3

Entregables:

- visualización del perfil ideológico en la vista detalle del medio;
- estados mínimos:
  - loading
  - error backend
  - `INSUFFICIENT_DATA`
  - perfil válido

Resultado:

- el atlas ya puede calcular, exponer y mostrar el perfil ideológico básico de un medio.

### Sprint 10. Exploración avanzada del atlas desde la navegación principal

Objetivo:

- hacer el atlas más útil desde la navegación principal, sin dashboards complejos.

#### Bloque 10.1

Entregables:

- enriquecimiento de `GET /api/countries/:code/outlets` con `biasSummary`;
- resumen básico por outlet en el listado principal;
- UI de tarjetas con estado, etiqueta dominante y volumen de análisis.

#### Bloque 10.2

Entregables:

- filtros MVP en el listado de outlets:
  - disponibilidad de perfil
  - estado del perfil
  - etiqueta dominante
- ordenación por:
  - nombre
  - análisis completados
  - perfil disponible primero

#### Bloque 10.3

Entregables:

- comparativa rápida entre dos outlets;
- selección de dos medios desde la página de país;
- consumo del perfil completo por outlet;
- visualización comparada de:
  - nombre
  - estado
  - etiqueta dominante
  - artículos políticos
  - análisis completados
  - distribución ideológica

Resultado:

- el atlas deja de ser un listado simple y pasa a ser una herramienta de exploración comparativa del sesgo ideológico.

## 5. Consolidación final del MVP

Tras Sprint 10 se realizó un bloque ligero de consolidación técnica y de UX, sin abrir nuevas features grandes.

Cambios aplicados:

- unificación de labels del perfil ideológico;
- mejora de textos y navegación en vistas de outlets;
- helper seguro para render de `websiteUrl` sin romper la UI si la URL está mal formada;
- control más amable de errores si backend o base de datos no están disponibles;
- respuesta `503` legible desde backend cuando PostgreSQL no está accesible;
- home del frontend protegida para no mostrar el error crudo de Prisma.

Resultado:

- el MVP queda más coherente, más demostrable y con menos fricción operativa.

### 5.1. Saneamiento de clasificación política histórica

Tras endurecer la heurística política para reducir falsos positivos, se añadió un flujo de mantenimiento para limpiar artículos históricos ya clasificados con reglas antiguas.

Entregables:

- mejora de `ClassifyPoliticalArticleUseCase` con coincidencias por palabra completa;
- separación entre señales políticas fuertes y contextuales;
- ampliación de descartes claros para entretenimiento, series/cine, deporte y tecnología no política;
- script `maintenance:reclassify-political` con `dry-run` y `--apply`;
- invalidación segura del análisis ideológico cuando un artículo deja de ser político.

Resultado aplicado al lote de España:

- `269` artículos procesados;
- `91` clasificaciones actualizadas;
- `48` artículos pendientes pasaron a clasificados;
- `5` artículos dejaron de ser políticos;
- `5` análisis ideológicos quedaron invalidados;
- un segundo `dry-run` devolvió `0` cambios, confirmando idempotencia.

### 5.2. Seeds manuales reproducibles por país

Se generalizó la seed manual creada inicialmente para España y se dejó preparada una estructura reutilizable por país para cargar medios y RSS fiables sin depender de altas manuales una a una desde la UI.

Estructura añadida:

- catálogo de seeds manuales por país;
- runner genérico con validación real del feed antes de insertar;
- scripts por país para aplicar la carga;
- soporte `--validate-only` para validar sin escribir en base.

Países preparados:

- `ES` España
- `GB` Reino Unido
- `FR` Francia
- `DE` Alemania
- `US` Estados Unidos

Estado de carga en esta fase:

- `ES` ya estaba cargado y operativo;
- `GB`, `FR` y `DE` quedaron preparados, validados y posteriormente cargados en la base;
- `US` se añadió después con la misma estructura idempotente y quedó cargado en la base para demo local.

Lotes validados:

- Reino Unido: `9` outlets, `18` feeds validados
- Francia: `8` outlets, `16` feeds validados
- Alemania: `8` outlets, `15` feeds validados
- Estados Unidos: `9` outlets, `18` feeds validados y cargados en base

Comandos operativos:

```bash
cd "media-bias-atlas/backend"

# Validación no destructiva
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:manual -- --country=GB --validate-only
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:manual -- --country=FR --validate-only
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:manual -- --country=DE --validate-only
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:manual -- --country=US --validate-only

# Aplicación real en base
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:uk
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:france
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:germany
TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run db:seed:usa
```

Comprobación posterior en base:

```bash
cd "media-bias-atlas/backend"
node -e "require('./node_modules/dotenv').config({path:'.env'}); const { Client } = require('./node_modules/pg'); (async()=>{ const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect(); const res = await client.query(\"select c.code, o.name, count(r.id)::int as feeds from outlets o join countries c on c.id = o.country_id left join rss_feeds r on r.outlet_id = o.id where c.code in ('GB','FR','DE','US') group by c.code, o.id, o.name order by c.code, o.name\"); console.log(JSON.stringify(res.rows, null, 2)); await client.end(); })().catch(err=>{ console.error(err.message || err); process.exit(1); });"
```

## 6. Estado acumulado tras Sprint 10

### Funcionalidad disponible hoy

- países sembrados y consultables;
- alta y consulta de medios por país;
- alta y consulta de feeds RSS por medio;
- sincronización manual de feeds;
- persistencia deduplicada de artículos;
- clasificación política por artículo y por feed;
- análisis ideológico por artículo;
- consulta del análisis ideológico persistido;
- resumen ideológico por feed;
- perfil ideológico por outlet;
- visualización del estado ideológico por artículo;
- visualización del perfil ideológico del medio;
- listado de outlets enriquecido con resumen básico;
- filtros y ordenación del listado de outlets;
- comparativa rápida entre dos medios;
- manejo controlado de indisponibilidad de base de datos.

### Validación técnica comprobada

Backend:

- `npx prisma validate --schema prisma/schema.prisma` -> válido;
- `npx tsc --noEmit` -> correcto;
- `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run tests/unit` -> `36/36` tests en verde.

Frontend:

- `npx tsc --noEmit` -> correcto;
- `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npx vitest run` -> `24/24` tests en verde;
- `npm run build` -> correcto.

Base de datos:

- migraciones de Sprint 5 y Sprint 6 aplicadas;
- `article_bias_analysis` presente;
- conexión validada con la `DATABASE_URL` activa.

Operatividad:

- si PostgreSQL cae, el backend devuelve `503` con mensaje legible;
- la home del frontend muestra un aviso claro en vez de romper con el mensaje crudo de Prisma;
- si `BIAS_AI_PROVIDER=disabled`, la app sigue operativa, pero no hará análisis ideológico real;
- si `BIAS_AI_*` está configurado, el backend puede ejecutar análisis reales contra Gemini u otro provider compatible.

## 7. Deuda técnica real restante

No son nuevas funcionalidades. Son límites o mejoras pendientes del MVP actual:

1. El análisis ideológico sigue trabajando principalmente con `title`, `url` y `publishedAt`; no hay cuerpo completo del artículo.
2. La comparativa entre outlets es MVP y no incorpora series temporales ni visualizaciones más ricas.
3. El proyecto depende de que PostgreSQL esté levantado externamente; no hay orquestación propia dentro de `media-bias-atlas/`.
4. Los scripts auxiliares de diagnóstico/integración del backend siguen siendo utilidades manuales y no parte formal del flujo de desarrollo.
5. El archivo de informe mantiene un nombre histórico (`1_7`) aunque el contenido ya cubre hasta Sprint 10.

## 8. Conclusión

`media-bias-atlas` ha quedado convertido en un MVP coherente, acumulativo y demostrable:

- Sprint 1 construyó la base técnica.
- Sprint 2 habilitó el catálogo de países y medios.
- Sprint 3 conectó medios con feeds RSS.
- Sprint 4 convirtió feeds en artículos persistidos.
- Sprint 5 separó artículos políticos del resto.
- Sprint 6 añadió análisis ideológico robusto por artículo.
- Sprint 7 lo hizo visible y resumible por feed.
- Sprint 8 alineó el provider IA real con Gemini.
- Sprint 9 introdujo el perfil ideológico por medio.
- Sprint 10 mejoró la exploración del atlas con resúmenes, filtros, ordenación y comparativa.

Resultado global:

- el producto ya puede registrar, ingerir, clasificar, analizar, resumir y comparar;
- el backend y el frontend están técnicamente cerrados para este tramo;
- el MVP está listo para demo y para consolidación en git;
- las condiciones operativas restantes son claras y acotadas:
  - PostgreSQL disponible
  - `BIAS_AI_*` configuradas para análisis reales

En su estado actual, `media-bias-atlas` ya representa una primera versión funcional del atlas ideológico construido como producto paralelo y desacoplado dentro del ecosistema técnico del repositorio.

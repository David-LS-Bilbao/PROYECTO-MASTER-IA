# Memoria Operativa del Sprint - AI Usage en Local

Fecha de cierre de esta memoria: `2026-03-24`

Rama de referencia validada:

- `feat/verity-ecosystem-launchers`

Objetivo de este documento:

- dejar trazado que se cambio en este sprint;
- dejar una guia corta pero completa para reconstruir el entorno local;
- evitar perder tiempo si cambias de equipo, borras el entorno o reinicias servicios;
- documentar como validar AI Usage con datos reales, no con trafico forzado ni datos inventados.

Este documento complementa estos dos archivos:

- [MANUAL_USUARIO_AI_OBSERVER.md](/mnt/c/Users/David/OneDrive/Desktop/GIT proyects/PROYECTO-MASTER-IA/docs/runbooks/MANUAL_USUARIO_AI_OBSERVER.md)
- [RUNBOOK_OTRO_EQUIPO_AGENTE.md](/mnt/c/Users/David/OneDrive/Desktop/GIT proyects/PROYECTO-MASTER-IA/docs/RUNBOOK_OTRO_EQUIPO_AGENTE.md)

Importante:

- esta memoria refleja la topologia local estable usada al final del sprint;
- el runbook antiguo de otro equipo estaba orientado a otra rama y a otra distribucion de puertos;
- para este entorno, la referencia correcta es la que se documenta aqui.

## 1. Resultado final del sprint

Al cerrar este sprint, el entorno local funcional queda asi:

- Verity backend: `http://localhost:3000`
- Verity frontend: `http://localhost:3001`
- Media Bias Atlas backend: `http://localhost:3002`
- Media Bias Atlas frontend: `http://localhost:3004`
- Panel AI Usage: `http://localhost:3001/admin/ai-usage`

El panel AI Usage ya queda validado con:

- fuentes `Verity` y `Media Bias Atlas` disponibles;
- runs reales persistidos en `ai_operation_runs`;
- filtros operativos funcionales;
- modelos visibles cuando existen runs reales;
- refresco manual con feedback visual;
- launcher de MBA desde Verity funcionando.

## 2. Que se ha cerrado en este sprint

### 2.1 Firebase Admin local en backend

Se dejo resuelta la carga de credenciales de Firebase Admin en desarrollo.

Estado final:

- el backend acepta credenciales por variables `FIREBASE_*`;
- tambien acepta `FIREBASE_SERVICE_ACCOUNT_PATH`;
- si no existe `service-account.json`, detecta automaticamente cualquier JSON `*firebase-adminsdk*.json` colocado dentro de `backend/`.

Implicacion practica:

- el archivo `backend/verity-news-4a798-firebase-adminsdk-fbsvc-0dbc197b85.json` sirve sin necesidad de renombrarlo;
- esto evita el fallo de `401` en endpoints que dependen de Firebase Admin.

### 2.2 Firebase publico en frontend

Se dejo estable la inicializacion del cliente Firebase en frontend.

Estado final:

- se usan nombres correctos de variables `NEXT_PUBLIC_FIREBASE_*`;
- en desarrollo existe fallback local para el proyecto `verity-news-4a798`;
- aun asi, la recomendacion sigue siendo dejar las variables publicas en `frontend/.env.local`.

Variables publicas relevantes:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### 2.3 Topologia local Verity + MBA

Se corrigio la topologia local para que ambos proyectos convivan sin conflicto.

Decision final:

- Verity usa `3000` backend y `3001` frontend;
- MBA usa `3002` backend y `3004` frontend.

Motivo:

- no se puede reutilizar `3001` para MBA backend si Verity frontend ya esta en `3001`.

### 2.4 AI Usage / AI Observer

Se cerraron varias mejoras y diagnosticos:

- el boton `Refrescar` muestra estado visible y toasts;
- los filtros operativos ya no quedan mudos sin contexto;
- el filtro `Modulo` mantiene disponibles `verity` y `media-bias-atlas` como modulos conocidos;
- `provider` y `model` siguen saliendo de datos reales persistidos;
- se confirmo que los modelos no aparecian por falta de runs reales, no por un bug de agregacion.

### 2.5 MBA hydration mismatch

El warning de hidratacion en MBA no era un bug funcional de la app.

Causa real detectada:

- extension `Dark Reader` inyectando atributos en `<html>` antes de hidratar.

Mitigacion aplicada:

- `suppressHydrationWarning` en el layout raiz de MBA.

### 2.6 Validacion con analisis reales

Se confirmo que AI Usage funciona con trafico real:

- en MBA se lanzo un analisis real de sesgo y se registro observabilidad;
- en Verity se lanzo un `POST /api/analyze/batch` real y se generaron runs persistidos;
- despues de eso el overview agregado ya devolvia ambos modulos y modelos reales.

## 3. Estado operativo que debes reproducir en otra maquina

## 3.1 Requisitos base

Desde la raiz del repo:

```bash
docker compose up -d postgres redis chromadb
```

Servicios esperados:

- PostgreSQL con `pgvector`
- Redis
- ChromaDB

## 3.2 Rama recomendada

```bash
git fetch --all --prune
git switch feat/verity-ecosystem-launchers
git pull
```

## 3.3 Credenciales y archivos locales

No subir secretos a Git.

Debes tener como minimo:

- `backend/.env`
- `frontend/.env.local`
- `media-bias-atlas/backend/.env`
- `media-bias-atlas/frontend/.env.local`
- JSON local de Firebase Admin dentro de `backend/`

## 4. Configuracion local minima

## 4.1 Verity backend

Archivo: `backend/.env`

Base minima:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://admin:adminpassword@localhost:5433/verity_news
GEMINI_API_KEY=...
```

Para autenticacion real:

- o bien definir `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`;
- o bien colocar el JSON descargado de Firebase dentro de `backend/`;
- o bien apuntar `FIREBASE_SERVICE_ACCOUNT_PATH` a ese JSON.

Recomendacion practica:

- dejar el JSON descargado de Firebase dentro de `backend/`;
- el backend ya lo autodetecta si cumple el patron `*firebase-adminsdk*.json`.

## 4.2 Verity frontend

Archivo: `frontend/.env.local`

Base minima:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL=http://localhost:3004
AI_USAGE_MBA_API_URL=http://localhost:3002
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Notas:

- el codigo de `AI_USAGE_MBA_API_URL` cae por defecto a `http://localhost:3002`;
- aun asi, conviene dejarla explicita en `.env.local`;
- la variable `NEXT_PUBLIC_MEDIA_BIAS_ATLAS_URL` es la que usa el launcher del sidebar.

## 4.3 MBA backend

Archivo: `media-bias-atlas/backend/.env`

Base minima:

```env
PORT=3002
NODE_ENV=development
DATABASE_URL=postgresql://admin:adminpassword@localhost:5433/media_bias_atlas?schema=public
BIAS_AI_PROVIDER=gemini
BIAS_AI_API_KEY=...
BIAS_AI_MODEL=gemini-2.5-flash
```

Notas:

- si `BIAS_AI_PROVIDER=disabled`, la app puede abrir, pero no generara observabilidad real util;
- para pruebas reales de AI Usage necesitas proveedor IA activo.

## 4.4 MBA frontend

Archivo: `media-bias-atlas/frontend/.env.local`

Base minima:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3002/api
```

## 5. Orden de arranque recomendado

## 5.1 Verity backend

```bash
cd backend
npx prisma migrate deploy
npm run dev
```

Comprobacion:

```bash
curl http://localhost:3000/health/check
```

Debe responder `status: ok`.

## 5.2 Verity frontend

```bash
cd frontend
npm run dev
```

Comprobacion:

```bash
curl -I http://localhost:3001
```

Debe responder `200 OK`.

## 5.3 MBA backend

```bash
cd media-bias-atlas/backend
npx prisma migrate deploy
npm run dev
```

Si la base esta vacia, cargar seeds:

```bash
npm run db:setup
npm run db:seed
npm run db:seed:spain
npm run db:seed:uk
npm run db:seed:france
npm run db:seed:germany
npm run db:seed:usa
```

Comprobacion:

```bash
curl http://localhost:3002/health
```

Debe responder `status: ok`.

## 5.4 MBA frontend

```bash
cd media-bias-atlas/frontend
npm run dev
```

Comprobacion:

```bash
curl -I http://localhost:3004
```

Debe responder `200 OK`.

## 6. Checklist de verificacion del entorno

Cuando el entorno esta bien levantado, debe cumplirse esto:

1. `http://localhost:3001` abre Verity.
2. `http://localhost:3004` abre Media Bias Atlas.
3. `http://localhost:3001/admin/ai-usage` abre el panel AI Usage.
4. Las tarjetas de fuente muestran `Verity` y `Media Bias Atlas` como disponibles.
5. El sidebar de Verity abre MBA correctamente.
6. El perfil y la sesion funcionan con Firebase.

## 7. Como generar datos reales de observabilidad

## 7.1 Verity

Opciones validas:

1. Desde la UI:
   - abrir una noticia;
   - lanzar el analisis IA;
   - usar el chat contextual si quieres generar mas actividad.

2. Via backend:

```bash
curl -X POST http://localhost:3000/api/analyze/batch \
  -H "Content-Type: application/json" \
  -d '{"limit":1}'
```

Resultado esperado:

- se crea al menos un run de `article_analysis`;
- puede aparecer tambien `json_repair`;
- puede aparecer `embedding_generation` si el flujo lo ejecuta.

## 7.2 Media Bias Atlas

Ruta recomendada:

1. abrir `http://localhost:3004`;
2. entrar en un pais;
3. entrar en un outlet;
4. abrir un feed;
5. pulsar `Analizar sesgo`.

Resultado esperado:

- se crean runs con `module = media-bias-atlas`;
- la operacion visible suele ser `article_bias_analysis`.

Importante:

- si el articulo ya estaba analizado y se reutiliza el resultado, no se crea run nuevo;
- si no hay invocacion IA real, AI Usage no inventa metricas.

## 8. Como comprobar si AI Usage esta leyendo datos reales

Consultas utiles en Verity:

```sql
select count(*) from ai_operation_runs;
select provider, model, count(*) from ai_operation_runs group by 1,2 order by 3 desc;
```

Consultas utiles en MBA:

```sql
select count(*) from ai_operation_runs;
select provider, model, count(*) from ai_operation_runs group by 1,2 order by 3 desc;
```

Lectura correcta del problema:

- si `provider` y `model` no aparecen en el panel, primero comprueba si existen runs;
- en esta implementacion, los modelos salen de `ai_operation_runs`, no de una lista fija.

Excepcion aplicada en UI:

- `Modulo` si muestra `verity` y `media-bias-atlas` como catalogo estable para no dejar ese filtro vacio.

## 9. Flujo de prueba manual recomendado

1. Abrir `http://localhost:3001/admin/ai-usage`.
2. Confirmar que ambas fuentes estan disponibles.
3. Lanzar una operacion IA real en Verity.
4. Lanzar una operacion IA real en MBA.
5. Pulsar `Refrescar`.
6. Verificar:
   - `Total de runs > 0`
   - `Distribucion por modulo` con `verity` y `media-bias-atlas`
   - `Distribucion por provider y modelo` con modelos reales
   - tabla de runs con estados, latencias y costes
7. Filtrar por `Modulo = verity`.
8. Filtrar por `Modulo = media-bias-atlas`.
9. Abrir el detalle de un run.
10. Revisar el catalogo de prompts y los comparadores.

## 10. Problemas reales encontrados durante este sprint

## 10.1 El panel no mostraba modelos

Causa real:

- no habia runs persistidos en `ai_operation_runs`.

Correccion aplicada:

- no se refactorizo la fuente de datos porque no era el problema;
- se genero trafico IA real y se valido que los modelos aparecian despues.

## 10.2 El filtro de modulos quedaba pobre o vacio

Causa:

- dependia demasiado de datos observados en caliente.

Correccion aplicada:

- el catalogo de filtros conserva `verity` y `media-bias-atlas` como modulos conocidos.

## 10.3 El boton Refrescar no daba feedback

Correccion aplicada:

- texto `Actualizando...`;
- animacion del icono;
- toast de exito o error;
- marca de tiempo del ultimo refresco manual.

## 10.4 MBA no abria o quedaba roto por puertos

Causa:

- mezcla de topologias antiguas con puertos incompatibles.

Correccion aplicada:

- fijar MBA backend en `3002`;
- fijar MBA frontend en `3004`;
- apuntar Verity a MBA con esas URLs.

## 10.5 Warning de hidratacion en MBA

Causa:

- `Dark Reader`.

Correccion aplicada:

- `suppressHydrationWarning` en el layout raiz.

## 10.6 Firebase local no cargaba bien

Causas detectadas:

- ausencia de variables publicas de Firebase en frontend;
- JSON de Firebase Admin presente pero no detectado por nombre no estandar.

Correcciones aplicadas:

- fallback local para Firebase publico en desarrollo;
- autodeteccion del JSON `firebase-adminsdk` en backend.

## 11. Riesgos y temas pendientes

Tema pendiente conocido:

- en Verity sigue apareciendo un fallo de `embedding_generation` con `text-embedding-004` por `404 Model not found`.

Impacto:

- AI Usage sigue funcionando;
- la observabilidad se registra igual;
- pero el panel puede mostrar ese error en ejecuciones recientes.

Recomendacion:

- corregir ese modelo o su endpoint antes de considerar el flujo totalmente limpio.

## 12. Comandos de comprobacion rapida

```bash
curl http://localhost:3000/health/check
curl -I http://localhost:3001
curl http://localhost:3002/health
curl -I http://localhost:3004
curl http://localhost:3001/api/internal/ai-usage/overview
```

## 13. Estado final esperado

Si todo esta bien, debes poder hacer esto sin tocar codigo:

1. levantar los cuatro servicios;
2. iniciar sesion en Verity;
3. abrir `http://localhost:3001/admin/ai-usage`;
4. ver ambas fuentes disponibles;
5. lanzar analisis reales en Verity y MBA;
6. refrescar el panel;
7. ver runs, providers y modelos reales.

Si en una maquina nueva no funciona, empieza siempre por este orden:

1. puertos;
2. `docker compose`;
3. `.env` y `.env.local`;
4. Firebase Admin;
5. Firebase publico;
6. proveedor IA real en Verity y MBA;
7. existencia real de filas en `ai_operation_runs`.

# Fase 4: UI interna de gestion de uso de IA

## Alcance implementado

- nueva ruta interna en `frontend`: `/admin/ai-usage`
- proxy interno de Next en `frontend/app/api/internal/ai-usage/*`
- agregacion de datos de observabilidad desde:
  - `backend` (Verity)
  - `media-bias-atlas/backend` (MBA)
- reutilizacion de los endpoints admin persistentes ya existentes y ampliacion minima con:
  - `GET /api/admin/ai-usage/prompts`
  - `GET /api/admin/ai-usage/compare`

## Proteccion y redaccion

- la pantalla no es publica: requiere sesion autenticada en la app
- el navegador no consume directamente `x-admin-secret`
- el secreto admin se usa solo en el proxy server-side de Next
- se mantiene la politica de redaccion existente:
  - no se exponen prompts interpolados completos
  - no se exponen respuestas completas del modelo
  - el detalle muestra `promptKey`, version, `templateHash`, `sourceFile` y `metadataJson` ya saneada

## Bloques funcionales entregados

- resumen global con runs, tokens conocidos, coste estimado conocido y errores
- distribuciones por modulo, operacion y provider/model
- tabla de ejecuciones con filtros por:
  - modulo
  - operacion
  - provider
  - modelo
  - status
  - rango temporal
- panel lateral de detalle por run
- catalogo de prompts/versiones con ultimo uso y numero de runs
- comparador agregado por:
  - modulo
  - operacion
  - provider
  - modelo

## Limitaciones honestas actuales

- la UI depende de que ambos backends esten accesibles y configurados:
  - `AI_USAGE_VERITY_API_URL`
  - `AI_USAGE_MBA_API_URL`
  - `ADMIN_API_SECRET` o `CRON_SECRET`
- si una fuente no responde, la pantalla sigue funcionando en modo parcial y lo indica explicitamente
- los tokens y el coste solo se agregan cuando el provider devolvio metricas reales
- el frontend de este entorno no tenia `node_modules`, asi que la validacion de build/lint/test del frontend no pudo ejecutarse aqui

## Pendiente para iteraciones posteriores

- endurecer autorizacion interna con un rol/admin explicito si el producto deja de ser solo uso interno
- anadir tests especificos del proxy interno y de la pantalla cuando el entorno frontend tenga dependencias instaladas
- evaluar persistencia de filtros en URL si se quiere compartir vistas internas entre operadores

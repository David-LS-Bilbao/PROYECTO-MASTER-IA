# n8n Webhook Receiver Contract

## Objetivo
Definir el receptor controlado en n8n para propuestas emitidas por Clawbot en staging.

## Naturaleza del receptor
- tipo: webhook de entrada
- entorno: staging/controlado
- función: recibir propuestas, no ejecutar persistencia directa por defecto

## Método y formato
- method: POST
- content-type: application/json

## Headers obligatorios
- X-Clawbot-Token
- X-Clawbot-Environment

## Reglas de validación mínimas
- rechazar si falta X-Clawbot-Token
- rechazar si X-Clawbot-Environment != staging
- rechazar si falta action
- rechazar si falta sourceType
- rechazar payloads vacíos
- rechazar confidence fuera de rango esperado
- rechazar campos inesperados críticos si rompen el contrato

## Actions permitidas en la primera fase
- propose_source
- report_incident
- summarize_status
- validate_site

## Actions no permitidas en la primera fase
- write_production
- delete_data
- execute_command
- call_docker
- direct_db_write

## Respuesta esperada del webhook
- 202 Accepted si la propuesta se recibe correctamente
- 400 Bad Request si el payload es inválido
- 401 Unauthorized si el token no es válido
- 403 Forbidden si el entorno no corresponde
- 500 solo para error interno real

## Flujo seguro
1. webhook recibe payload
2. n8n valida token y entorno
3. n8n valida forma mínima
4. n8n registra evento
5. n8n decide:
   - guardar en cola/revisión
   - reenviar a backend controlado
   - descartar
6. no persistir automáticamente en producción

## Evidencia mínima a registrar
- timestamp
- action
- sourceType
- title
- url
- confidence
- resultado de validación
- decisión final del flujo

## Estado actual
- contrato definido
- workflow aún no creado
- token aún no emitido
- integración aún no activada

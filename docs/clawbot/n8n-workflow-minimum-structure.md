# n8n Workflow Minimum Structure

## Objetivo
Definir la estructura mínima del workflow receptor para propuestas de Clawbot en staging.

## Nombre sugerido
clawbot_staging_receiver

## Nodos mínimos
1. Webhook
2. Code - Validate Headers
3. If - Header Validation OK?
4. Code - Validate Payload
5. If - Payload Validation OK?
6. Switch - Route by Action
7. Code - Build Audit Record
8. Respond to Webhook

## Lógica por nodo

### 1. Webhook
- método: POST
- path: /clawbot/staging/proposals
- respuesta manual
- recibe JSON

### 2. Code - Validate Headers
Responsabilidades:
- leer X-Clawbot-Token
- leer X-Clawbot-Environment
- marcar valid=true/false
- construir motivo de rechazo si aplica

Validaciones:
- token presente
- environment == "staging"

### 3. If - Header Validation OK?
- true -> seguir
- false -> responder 401 o 403

### 4. Code - Validate Payload
Validaciones mínimas:
- action presente
- sourceType presente
- confidence numérico si existe
- confidence entre 0 y 1
- title/string si existe
- url/string si existe
- metadata.agent esperado si existe

### 5. If - Payload Validation OK?
- true -> seguir
- false -> responder 400

### 6. Switch - Route by Action
Casos permitidos:
- propose_source
- report_incident
- summarize_status
- validate_site

Caso por defecto:
- unsupported_action -> responder 400

### 7. Code - Build Audit Record
Construir objeto normalizado con:
- receivedAt
- action
- sourceType
- title
- url
- confidence
- environment
- accepted
- decision
- rawPayload

Sin persistencia automática en producción.

### 8. Respond to Webhook
Respuestas:
- 202 accepted
- 400 bad request
- 401 unauthorized
- 403 forbidden

## Decisiones de seguridad
- no escribir automáticamente en producción
- no llamar a Docker
- no ejecutar comandos del sistema
- no escribir directamente en PostgreSQL
- registrar evidencia mínima
- permitir solo acciones explícitamente whitelisteadas

## Fase posterior
- convertir esta estructura en workflow JSON importable
- añadir token real
- añadir URL real del webhook
- conectar Clawbot solo cuando el flujo esté probado

# Webhook Output Contract

## Objetivo
Definir el único canal de salida permitido para Clawbot en staging.

## Regla principal
Clawbot no escribe directamente en base de datos ni en producción.
Clawbot solo puede emitir propuestas estructuradas hacia un webhook controlado.

## Destino previsto
- receptor: flujo controlado de n8n
- entorno: staging o canal intermedio controlado
- autenticación: token secreto en header
- método HTTP: POST
- content-type: application/json

## Headers previstos
- Content-Type: application/json
- X-Clawbot-Token: token_secreto
- X-Clawbot-Environment: staging

## Payload mínimo esperado
{
  "sourceType": "rss|web|incident|ops",
  "action": "propose_source|report_incident|summarize_status|validate_site",
  "title": "",
  "summary": "",
  "url": "",
  "confidence": 0,
  "tags": [],
  "metadata": {
    "agent": "clawbot-staging",
    "mode": "staging",
    "timestamp": ""
  }
}

## Restricciones
- no enviar HTML arbitrario
- no enviar binarios
- no enviar secretos
- no ejecutar acciones destructivas
- no disparar escritura automática en producción
- toda persistencia debe pasar por validación determinista

## Flujo previsto
1. Clawbot detecta o propone
2. Clawbot envía payload al webhook
3. n8n valida y filtra
4. backend decide si acepta
5. revisión humana cuando aplique

## Estado actual
- webhook aún no configurado
- token aún no configurado
- canal definido pero no activado

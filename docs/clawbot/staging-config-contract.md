# Staging Config Contract

## Objetivo
Definir el contrato mínimo de configuración para un entorno staging aislado de Verity News, preparado para futuras integraciones seguras con Clawbot/OpenClaw.

## Reglas de seguridad
- No reutilizar secretos de producción
- No reutilizar base de datos de producción
- No reutilizar red Docker de producción
- No exponer puertos públicamente en la fase inicial
- No dar acceso directo de Clawbot a PostgreSQL
- No dar acceso de Clawbot a docker.sock
- No montar credenciales reales del VPS dentro de Clawbot

## Backend staging - variables mínimas
- PORT
- NODE_ENV
- CORS_ORIGIN
- CRON_SECRET
- DATABASE_URL
- REDIS_URL
- GEMINI_API_KEY
- JINA_API_KEY
- NEWSAPI_KEY
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY

## Backend staging - observabilidad opcional
- SENTRY_DSN
- SENTRY_ENVIRONMENT
- SENTRY_TRACES_SAMPLE_RATE
- SENTRY_PROFILES_SAMPLE_RATE
- RELEASE_VERSION

## Frontend staging - variables mínimas
- NEXT_PUBLIC_API_URL
- NEXT_PUBLIC_CRON_SECRET
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID

## Frontend staging - opcionales
- NEXT_PUBLIC_ENABLE_ADSENSE
- NEXT_PUBLIC_ADSENSE_CLIENT_ID
- SENTRY_ORG
- SENTRY_PROJECT
- SENTRY_AUTH_TOKEN

## Decisiones de aislamiento
- repo staging en /opt/verity-stack/staging/verity-news-staging
- futuro compose separado del compose de producción
- futura red Docker separada de verity_network
- futura base de datos separada de la base de datos productiva
- acceso inicial solo privado o local
- Clawbot solo podrá emitir propuestas por webhook controlado

## Pendientes antes del despliegue
- definir nombres exactos de red, proyecto compose y volúmenes
- definir puertos internos y ausencia de exposición pública inicial
- crear ficheros .env exclusivos de staging
- crear compose de staging
- validar arranque backend/frontend sin impacto en producción

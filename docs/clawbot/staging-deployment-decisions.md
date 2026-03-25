# Staging Deployment Decisions

## Identidad del entorno
- entorno: staging
- proyecto base: verity-news-staging
- rama de trabajo: feat/clawbot-secure-ops

## Docker Compose project name
- COMPOSE_PROJECT_NAME=veritynews_staging

## Red Docker dedicada
- nombre propuesto: verity_staging_net
- tipo: bridge
- alcance: solo staging
- prohibido reutilizar: verity_network

## Servicios previstos en staging
- postgres-staging
- redis-staging
- backend-staging
- frontend-staging
- clawbot-staging (fase posterior, no ahora)

## Volúmenes previstos
- verity_staging_postgres_data
- verity_staging_redis_data
- verity_staging_backend_logs
- verity_staging_frontend_cache
- clawbot_staging_data (fase posterior)

## Ficheros de entorno previstos
- /opt/verity-stack/staging/verity-news-staging/env/backend.staging.env
- /opt/verity-stack/staging/verity-news-staging/env/frontend.staging.env
- /opt/verity-stack/staging/verity-news-staging/env/postgres.staging.env
- /opt/verity-stack/staging/verity-news-staging/env/clawbot.staging.env (fase posterior)

## Política de puertos inicial
- postgres: sin exposición pública
- redis: sin exposición pública
- backend: sin exposición pública inicial
- frontend: sin exposición pública inicial
- clawbot: sin exposición pública
- acceso permitido inicial: solo localhost, WireGuard o túnel SSH si fuera necesario

## Política de base de datos
- base exclusiva de staging
- usuario exclusivo de staging
- no compartir credenciales con producción
- no compartir volumen con producción

## Política de Clawbot
- no usar docker.sock
- no usar privileged
- no usar host network
- sin exec libre
- salida controlada solo por webhook a n8n en fases posteriores

## Criterio de reversibilidad
- todo el staging debe poder detenerse y eliminarse sin afectar:
  - /opt/verity-stack/verity-news
  - verity_network
  - n8n productivo
  - PostgreSQL productivo
  - NPM productivo

# Staging Status

## Fecha
- 2026-03-25

## Estado general
- staging operativo
- producción no modificada
- sin puertos públicos expuestos
- red Docker propia activa
- servicios de staging aislados de producción

## Servicios levantados
- postgres-staging: healthy
- redis-staging: healthy
- backend-staging: healthy
- frontend-staging: running

## Verificaciones realizadas
- backend responde 200 en /health/check
- frontend responde 200 en /
- frontend resuelve backend por DNS interno: backend-staging
- migraciones Prisma aplicadas solo en la base de datos de staging

## Recursos de aislamiento
- red: verity_staging_net
- volúmenes:
  - verity-news-staging_verity_staging_postgres_data
  - verity-news-staging_verity_staging_redis_data
  - verity-news-staging_verity_staging_frontend_node_modules
  - verity-news-staging_verity_staging_frontend_next

## Incidencias resueltas
- backend inicialmente en PORT=3000 y healthcheck en 3001
- frontend fallaba por falta de devDependencies para compilar next.config.ts
- frontend corregido usando npm ci --include=dev

## Restricciones mantenidas
- sin acceso público
- sin integración de Clawbot todavía
- sin docker.sock
- sin privileged
- sin host network
- sin escritura en producción

## Siguiente fase prevista
- definir método de acceso privado al staging
- opción preferente: túnel SSH o WireGuard
- no publicar staging en NPM en esta fase

## Validación adicional
- login/auth de staging activado
- MBA funciona en staging
- AI usage funciona en staging
- acceso privado por túnel SSH validado
- el staging queda apto como base para la siguiente fase de integración segura de Clawbot

## Hardening adicional aplicado
- frontend-staging migrado de bind mount a imagen propia
- frontend-staging mantiene acceso privado en 127.0.0.1:3002
- el repo staging ya no sufre modificaciones accidentales en package.json/package-lock.json
- se mantiene el aislamiento respecto a producción

## Validación de aislamiento de Clawbot
- contenedor clawbot-staging levantado en modo inerte
- comando activo: sleep infinity
- sin puertos publicados
- red propia: clawbot_staging_net
- root filesystem en modo read-only
- sin privileged
- con cap_drop: ALL
- con no-new-privileges=true
- sin docker.sock
- mounts limitados a:
  - /app/data
  - /app/logs
  - /app/config (solo lectura)

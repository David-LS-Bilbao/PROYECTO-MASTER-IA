# Clawbot Integration Contract

## Objetivo
Integrar Clawbot/OpenClaw como agente confinado dentro del entorno staging de Verity News, con mínimo privilegio y sin capacidad de afectar producción.

## Rol permitido
- descubrimiento y revisión de fuentes
- supervisión operativa
- resumen de estado
- validación puntual de sitios complejos
- apoyo por chat a la operativa técnica

## Rol prohibido
- no actuar como crawler principal
- no actuar como ingestor principal
- no escribir directamente en producción
- no escribir directamente en PostgreSQL
- no sustituir a n8n
- no sustituir al backend

## Restricciones obligatorias del contenedor
- sin privileged
- sin host network
- sin docker.sock
- sin mounts del sistema host fuera de su carpeta propia
- sin acceso a /var/run/docker.sock
- sin puertos públicos
- sin capacidad exec libre sobre el VPS

## Red y conectividad
- debe usar red Docker separada o subred controlada del staging
- acceso permitido solo a destinos necesarios
- salida principal prevista: webhook controlado
- comunicación con backend solo si se define explícitamente
- sin acceso a red productiva

## Secretos
- no reutilizar secretos de producción
- usar archivo/env propio de staging
- permisos restrictivos
- rotación sencilla y reversible

## Herramientas mínimas permitidas en MVP
- web_search
- web_fetch
- cron

## Herramientas deshabilitadas en MVP
- exec
- browser
- shell libre
- acceso a docker
- acceso directo a base de datos

## Canal de salida permitido
- webhook hacia flujo controlado
- payload estructurado
- revisión humana o validación determinista antes de persistir

## Observabilidad mínima
- logs del contenedor
- volumen propio si hiciera falta
- healthcheck simple
- reinicio controlado
- documentación de rollback

## Criterio de reversibilidad
- se debe poder detener y eliminar sin afectar:
  - verity_network
  - /opt/verity-stack/verity-news
  - n8n productivo
  - NPM productivo
  - PostgreSQL productivo

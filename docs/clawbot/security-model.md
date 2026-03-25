# Security Model

## Activos sensibles identificados
- secretos del backend y frontend
- base de datos PostgreSQL productiva
- instancia n8n productiva
- paneles internos
- red Docker productiva
- host VPS y sistema operativo

## Reglas base
- Clawbot no accede a producción
- Clawbot no escribe en PostgreSQL productivo
- Clawbot no ejecuta shell libre
- Clawbot no monta docker.sock
- Clawbot no recibe secretos reales del stack
- Clawbot solo emite propuestas por canal controlado

# Documentacion de `docs/`

Este directorio esta organizado por tipo de documento para facilitar busqueda y mantenimiento.

## Estructura recomendada

- `docs/` (core): documentos principales del proyecto (`MemoriaTFM.md`, `ESTADO_PROYECTO.md`, `CALIDAD.md`, `AI_RULES.md`, `SCORING_VNEXT.md`, etc.).
- `docs/architecture/`: arquitectura tecnica e integraciones (API interceptor, smart ingestion, metadata extractor).
- `docs/incidents/`: analisis de incidencias, fixes y validaciones tecnicas.
- `docs/runbooks/`: procedimientos operativos y guias manuales.
- `docs/audits/`: auditorias tecnicas o de seguridad.
- `docs/archive/`: backups o snapshots historicos.
- `docs/sprints/`: entregables y resumenes por sprint.
- `docs/refactors/`: documentos de refactorizacion y deuda tecnica.

## Convenciones

- Usar nombres claros y consistentes en `UPPER_SNAKE_CASE.md` o `Sprint-XX-Descripcion.md`.
- Mantener enlaces relativos dentro de `docs/`.
- Evitar dejar documentos nuevos sueltos en la raiz de `docs/` si pertenecen a una categoria existente.

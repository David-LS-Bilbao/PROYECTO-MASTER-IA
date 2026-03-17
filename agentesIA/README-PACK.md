# Pack de agentes — Media Bias Atlas

Este pack está pensado para trabajar con:

- Antigravity como orquestador
- VS Code + Codex como ejecutor de tareas pequeñas

## Archivos
- `AGENT-SYSTEM.md`: reglas maestras del proyecto
- `AGENT.md`: misión y alcance
- `AGENT-CODEX.md`: modo de trabajo para Codex
- `AGENT-ANTIGRAVITY.md`: modo de trabajo para Antigravity
- `PROMPTS-BASE.md`: primer lote de prompts

## Uso recomendado
1. Cargar `AGENT-SYSTEM.md` como contexto principal en Antigravity.
2. Añadir `AGENT.md` como resumen de producto.
3. Usar `PROMPTS-BASE.md` para arrancar el Sprint 1.
4. Mandar a Codex solo tareas pequeñas derivadas del plan.

## Orden sugerido de arranque
1. auditoría del repo
2. estrategia de base de datos
3. modelo Prisma
4. alta manual
5. ingesta
6. filtro político
7. agregación por medio
8. UI MVP

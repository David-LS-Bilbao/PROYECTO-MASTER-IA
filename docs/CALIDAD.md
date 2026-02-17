# Estandares de Calidad y Testing - Verity News

## Objetivo
Definir gates de calidad reproducibles antes de merge a `main`, siguiendo la filosofia 100/80/0 y la piramide de testing del proyecto.

## 1) Filosofia 100/80/0

### Zona Critica (100%)
Cobertura y casos exhaustivos en:
- Auth y autorizacion.
- Quota/coste (`quota.service.ts`, `token-taximeter.ts`).
- Gate de paywall (`paywall-detector.ts`, `analyze-article.usecase.ts`).
- Parseo/repair de salida LLM (Gemini) y limpieza de contenido.

### Zona Estandar (80%)
Cobertura fuerte (minimo 80%) en:
- Controladores HTTP y contratos API.
- Use cases de negocio no financieros.
- Hooks/componentes UI con estado.

### Zona Trivial (0%)
Sin obligacion de cobertura en:
- Configuracion sin logica.
- Tipos/DTOs pasivos.
- Presentacion puramente estetica.

## 2) Piramide de Testing

### Unit (base)
- Runner: `vitest`.
- Regla: mockear servicios externos (Gemini, Firebase, DB remota, Jina).
- Deben validar ramas de negocio, no solo happy path.

### Integracion (capa media)
- Validar contratos API reales (200/401/403/422/500 segun caso).
- Incluir escenarios de frontera (paywall, formatError, entitlement gating).

### E2E (cuspide)
- Playwright para smoke y flujos completos.
- Smoke no debe depender de auth fragil.

## 3) Gates Obligatorios Pre-Merge

Ejecutar exactamente:

```bash
# Backend
cd backend
npm run typecheck
npx vitest run
npm run test:coverage
```

```bash
# Frontend
cd frontend
npx tsc --noEmit
npm run test:run
npm run test:e2e:smoke
```

`npm run test:e2e` completo es recomendado cuando haya cambios de UI/routing/auth.

Playbook recomendado antes de merge a `main` (Render + Prisma + smoke):
- `docs/incidents/PRE_MERGE_PLAYBOOK_RENDER_PRISMA.md`

## 4) Umbrales y criterios PASS/FAIL

- Backend coverage: `branches >= 80%` (global), sin bajar umbrales.
- Cualquier fallo en zona critica implica **FAIL** global.
- No se acepta "coverage ciego": los tests deben cubrir reglas reales de negocio.
- Un merge es **PASS** solo si:
  - comandos obligatorios pasan,
  - no quedan tests flaky conocidos sin mitigacion,
  - no hay regresiones en contratos API criticos.

## 5) Casos Criticos Minimos a validar

- Auth:
  - token valido/invalido.
  - respuestas 401/403 correctas.
- Paywall:
  - `PAYWALL_BLOCKED` devuelve 422.
  - bloquea incluso con analisis cacheado legacy.
- Gemini resiliencia:
  - parse ok.
  - parse fail -> repair ok.
  - parse fail -> repair fail -> fallback seguro con `formatError`.
- Content cleaning:
  - elimina ruido JSON/HTML/flags internos.
  - evita citas basura y metadatos internos en salida final.

## 6) Evidencia de ejecucion (plantilla)

Registrar en informe final:

| Area | Comando | Resultado | Evidencia |
|------|---------|-----------|-----------|
| Backend typecheck | `cd backend && npm run typecheck` | PASS/FAIL | resumen salida |
| Backend tests | `cd backend && npx vitest run` | PASS/FAIL | archivos fallidos o 0 fallos |
| Backend coverage | `cd backend && npm run test:coverage` | PASS/FAIL | % branches global |
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | PASS/FAIL | resumen salida |
| Frontend unit | `cd frontend && npm run test:run` | PASS/FAIL | resumen salida |
| E2E smoke | `cd frontend && npm run test:e2e:smoke` | PASS/FAIL | resumen salida |

## 7) Politica de cambios durante QA

- Cambios minimos y enfocados.
- No tocar credenciales ni `.env`.
- No comandos destructivos sobre datos/volumenes en QA regular.
- Si un test falla por harness desalineado, primero corregir harness; luego validar bug real.

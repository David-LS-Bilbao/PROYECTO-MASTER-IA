# Sprint 27 - Entregables: Modelo Freemium y Suscripciones (MVP)

**Fecha**: 2026-02-10
**Estado**: OK - Completado

---

## Objetivo
Establecer la infraestructura tecnica para diferenciar usuarios FREE vs PREMIUM y permitir el upgrade mediante codigos promocionales (MVP).

---

## Cambios Tecnicos Realizados

### 1. Base de Datos (Prisma + PostgreSQL)
- Se elimino el campo `plan` y el enum `UserPlan`.
- Se creo el nuevo campo `subscriptionPlan` con el enum `SubscriptionPlan` (`FREE`, `PREMIUM`).
- Migraciones aplicadas:
  - `20260210104055_add_subscription_plan`
  - `20260210120000_fix_subscription_naming`

### 2. Backend (Node.js/Express)
- Sincronizacion de tipos en `auth.middleware.ts`, `analyze.controller.ts`, `analyze-article.usecase.ts` y `quota.service.ts`.
- Nuevo controlador `SubscriptionController`:
  - `POST /api/subscription/redeem`
  - `POST /api/subscription/cancel`
- Validacion de entrada con Zod (`subscription.schema.ts`).
- Rutas registradas en `server.ts` y DI en `dependencies.ts`.
- Codigos permitidos (MVP): `VERITY_ADMIN`, `MASTER_AI_2026`.

### 3. Frontend (Next.js)
- Tipos de usuario actualizados a `FREE | PREMIUM`.
- Nuevo componente `PricingModal` con comparativa de planes y canje de codigo.
- Boton "Gestionar Plan" en `ProfileHeader` y modal conectado en `/profile`.
- Refresco de sesion tras canje o cancelacion (router.refresh + reload).

### 4. Testing
- Tests de componentes ajustados para soporte de `PREMIUM`.

---

## Guia de Pruebas (Como Verificar)

### Estado Inicial
1. Registrar / loguear un usuario nuevo.
2. Verificar en "Mi Perfil" que aparece el badge "Plan Gratuito".

### Upgrade (Codigo Promocional)
1. Ir a "Mi Perfil" -> "Gestionar Plan".
2. En el modal, usar "Tienes un codigo promocional?".
3. Introducir el codigo `VERITY_ADMIN` o `MASTER_AI_2026`.
4. Click en "Canjear Codigo".

**Resultado esperado**:
- Toast de exito.
- El modal se cierra.
- El badge cambia a "Plan Premium".

### Downgrade (Cancelacion)
1. Con plan PREMIUM activo, abrir "Gestionar Plan".
2. Click en "Cancelar suscripcion".

**Resultado esperado**:
- Toast de exito.
- El plan vuelve a "FREE".

---

## Notas de Auditoria
- Seguridad: endpoint protegido por `authenticate` y validacion Zod.
- Deuda tecnica: codigos hardcodeados; deberian moverse a BD con limites y expiracion.
- Migracion: el campo `plan` fue eliminado (datos previos no se conservan).

---

## Siguiente Paso
- Integracion con pasarela de pago (Stripe).
- Tabla de codigos promocionales con reglas de uso.
- Activar publicidad (mock AdSense) para usuarios FREE.

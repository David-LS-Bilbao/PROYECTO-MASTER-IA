# Sprint 27: Monetización, Publicidad y Calidad de Código

**Fecha:** 10 de Febrero de 2026
**Estado:** ✅ Completado
**Objetivo:** Implementar modelo de negocio Freemium, integración de publicidad (AdSense) y asegurar calidad mediante testing exhaustivo (>80% cobertura).

## 🚀 Funcionalidades Implementadas

### 1. Modelo Freemium (Backend & DB)
* **Base de Datos:** Migración de `User` para incluir `subscriptionPlan` (`FREE` | `PREMIUM`).
* **Lógica de Negocio:**
    * Protección de rutas y limitaciones según plan.
    * Endpoint de "Backdoor" (`/api/subscription/redeem`) para canjear códigos promocionales (e.g., `VERITY_ADMIN`).
* **Seguridad:** Configuración de alertas de presupuesto en Google Cloud y protección de API Keys.

### 2. Sistema de Publicidad Híbrido (Frontend)
* **Arquitectura "Switchable":**
    * Variables de entorno (`NEXT_PUBLIC_ENABLE_ADSENSE`) para alternar entre Modo Desarrollo (Mocks) y Producción (Google real).
* **Componentes Inteligentes:**
    * `<AdSenseScript />`: Carga optimizada (`afterInteractive`) que se bloquea automáticamente si el usuario es Premium.
    * `<AdBanner />`: Renderiza placeholders en dev o `ins` tags en prod.
* **Integración UI:** Inserción nativa de anuncios en el `NewsGrid` (cada 6 noticias).

### 3. Interfaz de Usuario (UI/UX)
* **Modal de Suscripción:** Comparativa visual de planes y campo de canjeo de cupones.
* **Perfil de Usuario:** Indicadores visuales de estado (Badge "Plan Gratuito" vs "Premium Dorado").

## 🛡️ Calidad y Testing (QA)

### Backend (Cobertura >80%)
* **Unit & Integration Tests:**
    * `ChatGeneralUseCase`: Cobertura completa de lógica de IA y persistencia.
    * `IngestController`, `UserController`, `ChatController`: Tests de integración HTTP.
    * `Security`: Validación de saneamiento de inputs y autenticación.
* **Resultado:** Quality Gate superado (Functions: >60%, Lines: >80% en zonas críticas).

### Frontend (193 Tests Pasados)
* **Vitest + Testing Library:**
    * Configuración corregida para ignorar `node_modules`.
    * Solución de problemas de encoding (tildes) y timeouts en `scroll-to-top`.
    * Validación de renderizado condicional de anuncios (Premium vs Free).

## ⚠️ Notas de Despliegue
* **Variables de Entorno Requeridas en Vercel:**
    * `NEXT_PUBLIC_ENABLE_ADSENSE=true` (Solo en Producción).
    * `NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxx`.
* **Google Cloud:** Presupuesto de alerta configurado a 10€/mes.

---
**Próximos Pasos:** Despliegue final a Vercel y preparación de la defensa del proyecto.
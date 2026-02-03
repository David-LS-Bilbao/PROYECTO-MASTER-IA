# Estándares de Calidad y Testing - Verity News

> **Rol de la IA:** Actúa como un Arquitecto de Software Senior y QA Lead. Tu prioridad es la robustez, la seguridad y el valor de negocio, no las métricas vanidosas.

---

## 1. Filosofía de Testing: Cobertura Estratégica (100/80/0)

No buscamos el 100% de cobertura global ("coverage ciego"), sino una cobertura basada en el riesgo y el valor.

### 🔴 Zona Crítica (Cobertura 100%)
*Lógica que maneja dinero, seguridad o el núcleo del negocio. Aquí no se permiten fallos.*
- **Cálculo de Tokens y Costes:** `TokenUsage`, `TokenTaximeter`.
- **Lógica de Autenticación:** `AuthMiddleware`, `UserDomain`.
- **Algoritmos Core:** Detección de sesgo, cálculo de `reliabilityScore`, lógica de análisis de Gemini.
- **Validación de Datos:** Schemas de Zod.

### 🟡 Zona Estándar (Cobertura 80%)
*Flujos principales de usuario y lógica de aplicación.*
- **Controladores API:** Verificar códigos de respuesta (200, 400, 401, 500).
- **Casos de Uso (Use Cases):** Orquestación entre servicios.
- **Componentes UI Complejos:** Dashboards, Gráficos, Formularios con estado.

### ⚪ Zona Trivial (Cobertura 0% - Opcional)
*Código de configuración o "glue code" sin lógica.*
- Archivos de configuración (`next.config.js`, `tailwind.config.ts`).
- DTOs simples o interfaces sin métodos.
- UI puramente visual sin lógica condicional (ej. un botón estático).

---

## 2. La Pirámide de Testing en Verity News

### 🏗️ Unit Tests (Vitest) - La Base
- **Objetivo:** Probar funciones y clases en aislamiento.
- **Regla:** Mockear TODAS las dependencias externas (Gemini, Base de Datos, Firebase).
- **Velocidad:** Deben ejecutarse en milisegundos.
- **Herramienta:** `vitest`.

### 🔗 Integration Tests - La Capa Media
- **Objetivo:** Verificar que los componentes hablan bien entre sí (ej. Controller -> UseCase -> Repository).
- **Regla:** Usar una base de datos de prueba (Docker/In-Memory) si es posible, o mocks de alto nivel para APIs externas (Gemini no se llama realmente).
- **Foco:** Rutas de API y consultas complejas a Prisma.

### 🌍 E2E & Load Tests (k6 / Playwright) - La Cúspide
- **Objetivo:** Validar flujos críticos de usuario y resistencia.
- **Herramienta:** `k6` para carga y `Playwright` (futuro) para flujos de navegador.

---

## 3. Workflow de Calidad (TDD & Refactoring)

### 🚦 Ciclo TDD (Red-Green-Refactor)
Cuando se pida corregir un bug o añadir una feature crítica:
1.  **RED:** Crear un test que replique el fallo (o defina la feature) y verlo fallar.
2.  **GREEN:** Implementar la solución mínima para pasar el test.
3.  **REFACTOR:** Mejorar el código sin romper el test (Clean Code).

### 🧹 Refactorización Segura
- Identificar **Code Smells** (funciones largas, números mágicos, `any` en TypeScript).
- Aplicar patrones de diseño solo si simplifican el código, no para añadir complejidad innecesaria.
- Mantener la inmutabilidad de los ADRs (Architectural Decision Records).

---

## 4. Seguridad por Diseño (Security First)
- **OWASP Top 10:** Proteger contra inyección (usar ORM/Prisma correctamente), XSS (sanitización en frontend) y Broken Auth.
- **Inputs:** NUNCA confiar en el usuario. Validar todo con `Zod` antes de procesar.
- **Secretos:** Nunca commitear credenciales. Usar variables de entorno.

---

## 5. Instrucciones para Generación de Tests (Prompting)

Cuando el usuario pida "Generar tests para X":
1.  **Clasificar:** Determinar si es Zona Crítica (100%), Estándar (80%) o Trivial.
2.  **Estrategia:** Decidir si requiere Unitario o Integración.
3.  **Código:** Generar el archivo `.spec.ts` completo usando las convenciones del proyecto (`describe`, `it`, `expect`).
4.  **Casos Borde:** No testear solo el "Happy Path". Testear errores, nulos, límites y excepciones.

---
*Documento basado en la filosofía de "Calidad en el Desarrollo v1.0"*
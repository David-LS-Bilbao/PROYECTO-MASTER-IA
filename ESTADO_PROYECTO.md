# Estado del Proyecto - Verity News

> Última actualización: Sprint 1 - Inicio

---

## 🚦 Estado Actual: INICIALIZACIÓN

| Componente | Estado | Notas |
|------------|--------|-------|
| **Estructura Proyecto** | 🟡 En proceso | Carpetas creadas, Monorepo setup. |
| **Frontend** | 🟢 Listo | Vite + React + TS corriendo en puerto 5173. |
| **Backend** | 🟡 En proceso | Node + TS init. Falta config Express y Clean Arch. |
| **Base de Datos** | 🔴 Pendiente | Docker Compose y Prisma por configurar. |
| **IA Integration** | 🔴 Pendiente | API Keys y clientes no configurados. |

---

## 📅 Sprint 1: Cimientos y Arquitectura (Semana 1)

- [x] Definición del Stack y Modelo de Datos.
- [x] Creación de Repositorio y README.
- [ ] Configuración de **Claude Code** (Backend Setup).
- [ ] Levantar **Docker Compose** (Postgres + ChromaDB).
- [ ] Configurar **Prisma ORM** (Schema inicial).
- [ ] Endpoint de **Health Check** (Backend conectado a DB).
- [ ] Pipeline de Ingesta (Conexión a NewsAPI).

---

## 📝 Historial de Decisiones (ADRs)

- **ADR-001:** Se elige **Monorepo** para facilitar la gestión de tipos compartidos entre Front y Back.
- **ADR-002:** Se utilizará **Prisma** como ORM por su seguridad de tipos con TypeScript.
- **ADR-003:** Se usará **Gemini Flash** por ser multimodal, rápido y tener capa gratuita generosa.
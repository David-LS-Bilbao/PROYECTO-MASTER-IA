# 🗞️ Filter News - Plataforma Inteligente de Noticias con IA

> Trabajo Final de Máster - Máster en Desarrollo con Inteligencia Artificial (BIG School)

**Aplicación web multiplataforma** para búsqueda, análisis y consumo inteligente de noticias, potenciada por IA conversacional y técnicas avanzadas de NLP.

---

## 📋 Descripción

Filter News es una plataforma que combina:
- 🔍 **Búsqueda semántica** de noticias (keyword + RAG)
- 🤖 **Resúmenes automáticos** generados por IA
- 💬 **Chat conversacional** con contexto de noticias
- ⚙️ **Controles de IA personalizables** (temperatura, profundidad, veracidad)
- 📊 **Análisis de fuentes** consultadas
- 💾 **Gestión de favoritos** e historial

---

## 🎯 Objetivos del Proyecto

1. Demostrar aplicación práctica de conceptos del máster
2. Integrar IA en todo el ciclo de desarrollo
3. Construir una aplicación real y funcional
4. Documentar el proceso de desarrollo asistido por IA

---

## 🛠️ Stack Tecnológico

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **State:** Zustand + React Query
- **Testing:** Vitest + React Testing Library + Playwright

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express.js + TypeScript
- **Architecture:** Clean Architecture (Hexagonal)
- **Validation:** Zod
- **ORM:** Prisma
- **Testing:** Jest + Supertest

### IA & Data
- **LLM:** Gemini API (Google)
- **Embeddings:** Gemini Embeddings
- **Orchestration:** LangChain.js
- **Vector Store:** ChromaDB
- **News Sources:** NewsAPI + Google News RSS

### Infrastructure
- **Auth:** Firebase Authentication
- **Database:** PostgreSQL
- **User Prefs:** Firebase Firestore
- **Containerization:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **Deploy:** 
  - Frontend: Vercel
  - Backend: Railway
- **Monitoring:** Sentry + Firebase Analytics

---

## 📁 Estructura del Proyecto

```
filter-news/
├── frontend/                 # Aplicación React
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Páginas/vistas
│   │   ├── services/        # API clients
│   │   ├── store/           # Estado global (Zustand)
│   │   ├── hooks/           # Custom hooks
│   │   ├── utils/           # Utilidades
│   │   └── types/           # TypeScript types
│   ├── tests/               # Tests
│   └── package.json
│
├── backend/                  # API Node.js
│   ├── src/
│   │   ├── domain/          # Entidades y lógica de negocio
│   │   ├── application/     # Casos de uso
│   │   ├── infrastructure/  # Implementaciones (DB, APIs externas)
│   │   └── presentation/    # Controllers, routes
│   ├── tests/
│   └── package.json
│
├── docs/                     # Documentación
│   ├── REQUIREMENTS.md      # Requisitos del proyecto
│   ├── ARCHITECTURE.md      # Arquitectura del sistema
│   ├── API.md               # Documentación de API
│   ├── AI_USAGE.md          # Uso de IA en el desarrollo
│   ├── adrs/                # Architecture Decision Records
│   └── process/             # Documentación semanal del proceso
│
├── docker-compose.yml       # Orquestación de servicios
├── .github/
│   └── workflows/           # CI/CD pipelines
└── README.md                # Este archivo
```

---

## 🚀 Quick Start

### Prerrequisitos

- Node.js 20+
- npm o pnpm
- Docker y Docker Compose
- Cuentas:
  - Firebase (gratis)
  - Google AI Studio (Gemini API - gratis)
  - NewsAPI (gratis, 100 req/día)

### Instalación

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/filter-news.git
cd filter-news
```

2. **Configurar variables de entorno**
```bash
# Backend
cp backend/.env.example backend/.env
# Editar backend/.env con tus API keys

# Frontend
cp frontend/.env.example frontend/.env
# Editar frontend/.env con tus configuraciones
```

3. **Levantar servicios con Docker**
```bash
docker-compose up -d
```

4. **Instalar dependencias**
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

5. **Ejecutar migraciones de base de datos**
```bash
cd backend
npx prisma migrate dev
```

6. **Iniciar en modo desarrollo**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

7. **Abrir en el navegador**
```
http://localhost:5173
```

---

## 📖 Documentación

- [📋 Requisitos](./docs/REQUIREMENTS.md)
- [🏗️ Arquitectura](./docs/ARCHITECTURE.md)
- [🔌 API Reference](./docs/API.md)
- [🤖 Uso de IA](./docs/AI_USAGE.md)
- [📝 ADRs](./docs/adrs/)

---

## 🧪 Testing

```bash
# Tests unitarios backend
cd backend && npm test

# Tests unitarios frontend
cd frontend && npm test

# Tests E2E
cd frontend && npm run test:e2e
```

---

## 📦 Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel deploy
```

### Backend (Railway)
```bash
# Conectar repo a Railway
# Configurar variables de entorno en Railway dashboard
# Deploy automático en cada push a main
```

---

## 🤝 Contribución

Este es un proyecto académico (TFM), pero si quieres contribuir:

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto es parte de un Trabajo Final de Máster y está bajo licencia MIT.

---

## 👤 Autor

**David** - Estudiante del Máster en Desarrollo con IA (BIG School)

- 📧 Email: [tu-email]
- 💼 LinkedIn: [tu-linkedin]
- 🐙 GitHub: [@tu-usuario](https://github.com/tu-usuario)

---

## 🙏 Agradecimientos

- **BIG School** - Por el máster en Desarrollo con IA
- **Comunidad Open Source** - Por las increíbles herramientas
- **Claude (Anthropic)** - Asistente IA utilizado en el desarrollo

---

## 📊 Estado del Proyecto

![Status](https://img.shields.io/badge/status-in%20development-yellow)
![Progress](https://img.shields.io/badge/progress-0%25-red)

**Inicio:** Enero 2026  
**Entrega estimada:** Mayo 2026  
**Duración:** 16 semanas

---

## 🗓️ Hitos
## 🗓️ Roadmap de Desarrollo (Plan Acelerado)

- [ ] **Sprint 1 (Cimientos):** Arquitectura Hexagonal, Configuración Docker y Pipeline de Ingesta.
- [ ] **Sprint 2 (Core IA):** Integración de Gemini, Sistema RAG y Base de Datos Vectorial.
- [ ] **Sprint 3 (Experiencia):** Interfaz React completa, Filtros y Chat Conversacional.
- [ ] **Sprint 4 (Refinamiento):** Tests E2E, Auditoría de Seguridad, Despliegue y Documentación final.

---

**🚀 ¡Proyecto en desarrollo!**

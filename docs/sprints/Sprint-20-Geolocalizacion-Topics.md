# Sprint 20: Geolocalización + Reestructuración de Categorías 🌍

**Fecha**: 2026-02-09
**Estado**: ✅ Completado (Fases 1, 2 y 3)
**Objetivo**: Preparar la infraestructura para noticias geolocalizadas y categorías unificadas

---

## 📋 Resumen Ejecutivo

Sprint 20 establece las bases para un sistema de categorización mejorado y soporte de geolocalización de usuarios, permitiendo contenido personalizado por ubicación.

### ✅ Logros - Fase 1 (Backend Schema)

| Componente | Tecnología | Estado | Descripción |
|------------|------------|--------|-------------|
| **User Location** | Prisma String? | ✅ | Campo `location` añadido |
| **Topic Model** | Prisma + PostgreSQL | ✅ | Modelo Topic con 8 categorías |
| **Database Migration** | Prisma Migrate | ✅ | Migración aplicada exitosamente |
| **Database Seed** | TypeScript + Prisma | ✅ | 8 temas iniciales creados |
| **Seed Configuration** | prisma.config.ts | ✅ | Comando `prisma db seed` listo |

---

## 🎯 Objetivos del Sprint Completo

### Fase 1: Base de Datos ✅
- [x] Añadir campo `location` al modelo User
- [x] Crear modelo `Topic` para categorización
- [x] Definir 8 categorías unificadas con slugs URL-friendly
- [x] Ejecutar migración de base de datos
- [x] Poblar base de datos con seed inicial

### Fase 2: Backend API ✅ (Completada)
- [x] Crear `TopicRepository` (Domain + Infrastructure)
- [x] Crear Use Cases: `GetAllTopics`, `GetTopicBySlug`
- [x] Crear `TopicController` con endpoint `GET /api/topics`
- [x] Actualizar `UserController` para gestionar `location`
- [x] Lógica inteligente para categoría "Local" basada en ubicación del usuario
- [x] Lógica inteligente para categoría "Ciencia y Tecnología" (búsqueda paralela)

### Fase 3: Frontend ✅ (Completada)
- [x] Actualizar sidebar con 8 nuevas categorías (iconos Lucide)
- [x] Campo de ubicación en perfil de usuario
- [x] Integración de zustand para gestionar estado del formulario
- [x] Actualizar routing para soportar slugs de temas (/?topic=espana)
- [x] Hooks actualizados (useNews, useNewsInfinite) para soportar topics dinámicos

---

## 🗂️ Cambios en Base de Datos

### 1. Schema Prisma Actualizado

**Archivo**: `backend/prisma/schema.prisma`

#### Modelo User - Campo Location
```prisma
model User {
  id          String   @id // Firebase UID como ID primario
  email       String   @unique
  name        String?
  picture     String?
  plan        UserPlan @default(FREE)
  location    String?  // ⭐ NUEVO: Sprint 20 - Geolocalización
  preferences Json?
  usageStats  Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  favorites     Favorite[]
  searchHistory SearchHistory[]
  chats         Chat[]

  @@map("users")
}
```

**Uso del campo `location`**:
- Formato libre: `"Madrid, España"`, `"Barcelona"`, `"Andalucía"`
- Opcional: usuarios pueden no configurarlo
- Futuro: base para filtrado de noticias locales

---

#### Modelo Topic - Categorías del Sistema
```prisma
model Topic {
  id          String   @id @default(uuid())
  name        String   // Nombre display: "Ciencia y Tecnología"
  slug        String   @unique  // URL-friendly: "ciencia-tecnologia"
  description String?  // Descripción SEO
  order       Int?     // Orden de visualización
  createdAt   DateTime @default(now())

  @@map("topics")
}
```

**Ventajas del modelo Topic**:
- ✅ Slugs URL-friendly para routing SEO
- ✅ Descripciones personalizadas por categoría
- ✅ Orden configurable (no hardcoded)
- ✅ Extensible: fácil añadir categorías nuevas

---

### 2. Migración Aplicada

**Archivo**: `backend/prisma/migrations/20260209091431_add_location_and_topics/migration.sql`

```sql
-- AlterTable
ALTER TABLE "users" ADD COLUMN "location" TEXT;

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");
```

**Resultado**:
- ✅ Base de datos sincronizada con schema
- ✅ Sin downtime (campos opcionales)
- ✅ Índice único en `topics.slug` para búsquedas eficientes

---

## 📂 Estructura de Temas Unificados

### Categorías Definidas (8 Temas)

| # | Nombre | Slug | Descripción | Fusión |
|---|--------|------|-------------|--------|
| 1 | **España** | `espana` | Noticias nacionales de España | - |
| 2 | **Internacional** | `internacional` | Actualidad mundial y noticias internacionales | - |
| 3 | **Local** | `local` | Noticias de tu localidad (basado en geolocalización) | **🆕 NUEVO** |
| 4 | **Economía** | `economia` | Finanzas, mercados, empresas y economía | - |
| 5 | **Ciencia y Tecnología** | `ciencia-tecnologia` | Innovación, ciencia, tecnología y descubrimientos | ⭐ **Fusión** |
| 6 | **Entretenimiento** | `entretenimiento` | Cine, series, música, cultura y espectáculos | - |
| 7 | **Deportes** | `deportes` | Fútbol, baloncesto y actualidad deportiva | - |
| 8 | **Salud** | `salud` | Bienestar, medicina, nutrición y vida saludable | - |

### Cambios Importantes

#### ⭐ Fusión: Ciencia + Tecnología
**Antes** (Sprint 1-19):
- Categoría "Ciencia" (ciencia)
- Categoría "Tecnología" (tecnologia)

**Después** (Sprint 20+):
- Categoría **"Ciencia y Tecnología"** (`ciencia-tecnologia`)

**Razón**: Temáticas muy relacionadas, mejor UX con menos fragmentación.

#### 🆕 Nueva Categoría: Local
**Propósito**: Noticias específicas de la ubicación del usuario
**Requisito**: Campo `User.location` configurado
**Uso futuro**: Filtrado por ciudad/región en RSS o APIs externas

---

## 🔧 Configuración de Seed

### Archivo de Seed

**Archivo**: `backend/prisma/seed.ts`

```typescript
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Inicializar con adapter (requerido por el proyecto)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Temas Unificados (Sprint 20)
 * - Fusión de "Ciencia" + "Tecnología" → "Ciencia y Tecnología"
 * - Slugs URL-friendly para routing
 */
const defaultTopics = [
  {
    name: 'España',
    slug: 'espana',
    description: 'Noticias nacionales de España',
    order: 1,
  },
  {
    name: 'Internacional',
    slug: 'internacional',
    description: 'Actualidad mundial y noticias internacionales',
    order: 2,
  },
  {
    name: 'Local',
    slug: 'local',
    description: 'Noticias de tu localidad (basado en geolocalización)',
    order: 3,
  },
  {
    name: 'Economía',
    slug: 'economia',
    description: 'Finanzas, mercados, empresas y economía',
    order: 4,
  },
  {
    name: 'Ciencia y Tecnología',
    slug: 'ciencia-tecnologia',
    description: 'Innovación, ciencia, tecnología y descubrimientos',
    order: 5,
  },
  {
    name: 'Entretenimiento',
    slug: 'entretenimiento',
    description: 'Cine, series, música, cultura y espectáculos',
    order: 6,
  },
  {
    name: 'Deportes',
    slug: 'deportes',
    description: 'Fútbol, baloncesto y actualidad deportiva',
    order: 7,
  },
  {
    name: 'Salud',
    slug: 'salud',
    description: 'Bienestar, medicina, nutrición y vida saludable',
    order: 8,
  },
];

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');
  console.log('📂 Creando temas por defecto...');

  for (const topic of defaultTopics) {
    const created = await prisma.topic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        description: topic.description,
        order: topic.order,
      },
      create: topic,
    });
    console.log(`✅ Tema creado/actualizado: ${created.name} (${created.slug})`);
  }

  console.log('✨ Seed completado exitosamente!');
  console.log(`📊 Total de temas: ${defaultTopics.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Configuración en prisma.config.ts

**Archivo**: `backend/prisma.config.ts`

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts', // ⭐ NUEVO
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### Ejecución del Seed

```bash
cd backend
npx prisma db seed
```

**Resultado**:
```
🌱 Iniciando seed de base de datos...
📂 Creando temas por defecto...
✅ Tema creado/actualizado: España (espana)
✅ Tema creado/actualizado: Internacional (internacional)
✅ Tema creado/actualizado: Local (local)
✅ Tema creado/actualizado: Economía (economia)
✅ Tema creado/actualizado: Ciencia y Tecnología (ciencia-tecnologia)
✅ Tema creado/actualizado: Entretenimiento (entretenimiento)
✅ Tema creado/actualizado: Deportes (deportes)
✅ Tema creado/actualizado: Salud (salud)
✨ Seed completado exitosamente!
📊 Total de temas: 8
```

---

## 🧪 Verificación

### Script de Verificación

**Archivo**: `backend/prisma/verify-topics.ts` (temporal)

```typescript
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔍 Verificando temas en base de datos...\n');

  const topics = await prisma.topic.findMany({
    orderBy: { order: 'asc' },
  });

  console.log(`📊 Total de temas encontrados: ${topics.length}\n`);

  topics.forEach((topic) => {
    console.log(`✅ ${topic.order}. ${topic.name} (${topic.slug})`);
    console.log(`   📝 ${topic.description}`);
    console.log(`   🆔 ID: ${topic.id}`);
    console.log(`   📅 Creado: ${topic.createdAt.toLocaleString('es-ES')}\n`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Ejecutar**:
```bash
npx ts-node prisma/verify-topics.ts
```

---

## 📁 Archivos Modificados/Creados

### Creados
1. ✅ **`backend/prisma/seed.ts`** - Seed con 8 temas y adapter PostgreSQL
2. ✅ **`backend/prisma/verify-topics.ts`** - Script de verificación (temporal)
3. ✅ **`backend/prisma/migrations/20260209091431_add_location_and_topics/`** - Migración SQL
4. ✅ **`docs/sprints/Sprint-20-Geolocalizacion-Topics.md`** - Este documento

### Modificados
1. ✅ **`backend/prisma/schema.prisma`** - Añadido `User.location` + modelo `Topic`
2. ✅ **`backend/prisma.config.ts`** - Configurado comando de seed

---

## ✅ Implementación Completada

### Fase 2: Backend API

#### 1. Domain Layer (Implementado)
**Archivos creados**:
- `backend/src/domain/entities/topic.entity.ts` - Entidad Topic con método reconstitute
- `backend/src/domain/repositories/topic.repository.ts` - Interface ITopicRepository

**Entidad Topic implementada**:
```typescript
export class Topic {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly slug: string,
    public readonly description: string | null,
    public readonly order: number | null,
    public readonly createdAt: Date
  ) {}

  static reconstitute(data: any): Topic {
    return new Topic(
      data.id,
      data.name,
      data.slug,
      data.description,
      data.order,
      data.createdAt
    );
  }
}
```

#### 2. Application Layer (Implementado)
**Use Cases creados**:
- `GetAllTopicsUseCase` - Obtiene lista de temas ordenados
- `GetTopicBySlugUseCase` - Busca tema específico por slug

#### 3. Infrastructure Layer (Implementado)
**Implementaciones**:
- `PrismaTopicRepository` - Implementa findAll() y findBySlug()
- `TopicController` - Endpoints REST públicos (sin autenticación)

**Endpoints implementados**:
```
GET /api/topics
Response: [
  {
    "id": "uuid",
    "name": "España",
    "slug": "espana",
    "description": "Noticias nacionales de España",
    "order": 1
  },
  ...
]

GET /api/topics/:slug
Response: {
  "id": "uuid",
  "name": "España",
  "slug": "espana",
  "description": "Noticias nacionales de España",
  "order": 1
}
```

#### 4. User Location Management (Implementado)
**UserController actualizado**:
```typescript
// GET /api/users/profile
Response: {
  "id": "firebase-uid",
  "email": "user@example.com",
  "name": "Usuario",
  "location": "Madrid, España", // ⭐ NUEVO
  ...
}

// PATCH /api/users/profile
Body: { "name": "...", "location": "Madrid, España" }
Response: { "success": true, "profile": {...} }
```

#### 5. Lógica Inteligente de Categorías (Implementado)
**NewsController actualizado con smart routing**:
- **Categoría "Local"**: Usa `user.location` para crear query personalizado
- **Categoría "Ciencia y Tecnología"**: Búsqueda paralela en ambas subcategorías
- **Auto-fill**: Detecta categorías vacías y dispara ingesta automática

---

### Fase 3: Frontend

#### 1. Componentes UI (Implementados)
**Sidebar actualizado** (`components/layout/sidebar.tsx`):
- 8 nuevos topic items con iconos específicos de Lucide:
  - España → Flag
  - Internacional → Globe
  - Local → MapPin
  - Economía → TrendingUp
  - Ciencia y Tecnología → FlaskConical
  - Entretenimiento → Film
  - Deportes → Trophy
  - Salud → HeartPulse
- Navegación unificada con Links a `/?topic={slug}`

**ProfileHeader actualizado** (`components/profile/ProfileHeader.tsx`):
- Campo de ubicación: "Ubicación (Ciudad, País)"
- Input con placeholder: "Ej: Madrid, España"
- Integración con zustand store

#### 2. Hooks (Actualizados)
- **`useNews.ts`**: Cambiado de `CategoryId` a `string` para soportar topics dinámicos
- **`useNewsInfinite.ts`**: Actualizado para aceptar cualquier topic
- **`usePrefetchNews`**: Actualizado para nueva estructura

#### 3. State Management (Implementado)
**Profile Form Store** (`stores/profile-form.store.ts`):
```typescript
interface ProfileFormState {
  name: string;
  location: string; // ⭐ NUEVO: Sprint 20
  selectedCategories: string[];
  setLocation: (location: string) => void;
  ...
}
```

#### 4. Routing (Implementado)
- Routing actualizado para soportar slugs: `/?topic=ciencia-tecnologia`
- useSearchParams con Suspense boundary para Next.js 13+
- Compatibilidad con favoritos: `/?topic=favorites`

---

## 📊 Métricas Sprint 20 - Fase 1

| Métrica | Valor |
|---------|-------|
| **Archivos Nuevos** | 4 (schema, seed, verify, doc) |
| **Archivos Modificados** | 2 (schema, config) |
| **Líneas de Código** | ~250 |
| **Temas Creados** | 8 categorías |
| **Tiempo Implementación** | ~2 horas |
| **Tests Manuales** | ✅ Verificación exitosa |

---

## ✅ Criterios de Aceptación - Fase 1

- [x] Campo `User.location` existe en schema y BD
- [x] Modelo `Topic` existe con campos requeridos
- [x] Migración aplicada sin errores
- [x] 8 temas creados en base de datos
- [x] Comando `prisma db seed` funcional
- [x] Seed usa adapter PostgreSQL correctamente
- [x] Slugs son URL-friendly (sin espacios ni acentos)
- [x] Documentación completa del sprint

---

## 🎓 Lecciones Aprendidas

### 1. PrismaClient con Adapter
**Problema**: Inicialización estándar `new PrismaClient()` fallaba.
**Solución**: Usar `PrismaPg` adapter:
```typescript
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

### 2. Configuración de Seed
**Problema**: Prisma no reconocía comando de seed.
**Solución**: Configurar en `prisma.config.ts`:
```typescript
migrations: {
  seed: 'ts-node prisma/seed.ts',
}
```

### 3. Regenerar Cliente
**Importante**: Siempre ejecutar `npx prisma generate` después de modificar el schema para actualizar tipos TypeScript.

---

## 🔗 Referencias

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Seeding](https://www.prisma.io/docs/guides/database/seed-database)
- [PostgreSQL Adapter](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- Sprint 18: Per-User Favorites (contexto de autenticación)
- Sprint 19: Waterfall Search (contexto de búsqueda)

---

## 📝 Conclusión

**Sprint 20 - Completado** establece un sistema robusto de categorización y geolocalización de usuarios:

1. ✅ **Schema actualizado** con campo `location` y modelo `Topic`
2. ✅ **Migración aplicada** sin downtime
3. ✅ **8 temas unificados** creados en BD con slugs SEO-friendly
4. ✅ **Seed configurado** para facilitar deploy en otros entornos
5. ✅ **Backend API implementado** con TopicRepository, Use Cases y Controllers
6. ✅ **Frontend actualizado** con sidebar de 8 categorías y campo location en perfil
7. ✅ **Smart routing** para Local y Ciencia y Tecnología
8. ✅ **Type system migrado** de CategoryId (union) a string dinámico

**Fusión importante**: "Ciencia" + "Tecnología" → "Ciencia y Tecnología"
**Nueva categoría**: "Local" (usa `user.location` para personalizar búsquedas)

**Archivos modificados**:
- Backend: 12 archivos (Domain, Application, Infrastructure)
- Frontend: 8 archivos (Hooks, Components, Stores, Pages)

**Status**: ✅ Sprint 20 completado - Sistema de categorías dinámico operativo

---

**Próximo Sprint**: Sprint 22 - UI Cleanup y optimización de búsqueda con keywords 🚀

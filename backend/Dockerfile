# ============================================
# Stage 1: Builder - Compilación de TypeScript
# ============================================
FROM node:20-slim AS builder

# Cache buster - invalida cache de Docker cuando cambia
ARG CACHEBUST=1

WORKDIR /app

# Instalar dependencias del sistema necesarias para Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

# Instalar dependencias (postinstall ejecutará prisma generate automáticamente)
RUN npm ci

# Copiar archivos de configuración de TypeScript
COPY tsconfig*.json ./

# Copiar código fuente
COPY src ./src

# Compilar TypeScript (build script ya incluye prisma generate)
RUN npm run build

# ============================================
# Stage 2: Runner - Imagen de producción
# ============================================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Limitar heap de Node.js para plan Starter de Render (512MB RAM)
# Sin este límite, Node.js puede crecer hasta crashear (exit 134 = OOM kill)
ENV NODE_OPTIONS=--max-old-space-size=350

# Instalar dependencias del sistema para Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias y schema de Prisma
COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

# Instalar solo dependencias de producción
# El postinstall generará Prisma Client automáticamente
RUN npm ci --omit=dev

# Copiar código compilado desde builder
COPY --from=builder /app/dist ./dist

# Verificar que Prisma Client fue generado (debug)
RUN ls -la node_modules/.prisma/client || echo "WARNING: Prisma Client not found"

# Puerto expuesto
EXPOSE 3001

# Health check - start-period alto para cold start de Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health/check', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Comando de inicio:
# - aplica migraciones pendientes en la BD de produccion
# - arranca API solo si migrate deploy fue exitoso
# IMPORTANTE: usar binario local de Prisma (evita que npx descargue en runtime = menos memoria)
#
# NEON POOLER FIX: prisma migrate deploy necesita conexion directa (sin PgBouncer) porque
# usa pg_advisory_lock de nivel sesion. PgBouncer en modo transaccion no soporta locks
# de sesion → P1002 timeout. Se sobreescribe DATABASE_URL con DIRECT_URL solo para
# el comando migrate (prefix assignment: no afecta a node dist/index.js).
CMD ["sh", "-c", "DATABASE_URL=${DIRECT_URL:-$DATABASE_URL} ./node_modules/.bin/prisma migrate deploy && node dist/index.js"]

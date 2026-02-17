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

# Instalar dependencias del sistema para Prisma
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copiar archivos de dependencias y schema de Prisma
COPY package*.json ./
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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health/check', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Comando de inicio
CMD ["node", "dist/index.js"]

# Sprint 36 - DevOps: Optimización del Arranque en Render

**Fecha**: 19 de febrero de 2026
**Tipo**: Infrastructure / DevOps
**Motivación**: El servicio en Render presentaba crashes al arrancar tras periodos de inactividad (`exit status 134` - OOM kill del kernel Linux).

---

## Problema

Al arrancar el servidor tras horas sin actividad (cold start en Render Starter), Node.js excedía el límite de RAM disponible:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
Exited with status 134
```

### Causas identificadas

| Causa | Impacto |
|-------|---------|
| `npx prisma migrate deploy` en el CMD | `npx` descarga y ejecuta Prisma CLI en cada arranque, consumiendo ~50-80MB extra innecesariamente |
| Sin límite de heap de Node.js | Node.js sin `--max-old-space-size` puede crecer hasta superar los 512MB del plan Starter |
| `start-period=40s` en healthcheck | Render mata el proceso antes de que termine de arrancar si tarda más de 40s |

---

## Solución implementada

### Cambios en `backend/Dockerfile`

#### 1. Límite de heap de Node.js

```dockerfile
# Antes:
ENV NODE_ENV=production

# Después:
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=350
```

**Por qué 350MB**: Con 512MB de RAM del plan Starter, el SO y procesos del sistema ocupan ~50-80MB. El límite de 350MB deja margen para los spikes del arranque (Prisma, Firebase Admin SDK, Sentry profiling) sin que el OOM killer mate el proceso.

#### 2. Binario local de Prisma en vez de npx

```dockerfile
# Antes:
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

# Después:
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
```

**Por qué**: `npx` en cada arranque inicializa el resolvedor de paquetes de npm, descarga temporalmente Prisma CLI y lo ejecuta. Usar el binario ya instalado en `node_modules/.bin/` es directo, rápido y consume ~50-80MB menos de memoria durante el arranque.

#### 3. Healthcheck start-period ampliado

```dockerfile
# Antes:
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3

# Después:
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3
```

**Por qué**: El cold start de Render (descarga imagen Docker + `prisma migrate deploy` + inicialización de Firebase Admin SDK + Sentry + pgvector) puede tardar hasta 60-80 segundos. Con `start-period=40s`, el healthcheck fallaba antes de que el servidor estuviera listo, provocando reinicios en bucle.

---

## Resultado esperado

| Métrica | Antes | Después |
|---------|-------|---------|
| Exit status en cold start | 134 (OOM kill) | 0 (arranque correcto) |
| Memoria consumida en arranque | >512MB | ~300-350MB |
| Tiempo hasta healthcheck OK | Timeout | ~60-80s (dentro del start-period) |
| npx en runtime | Sí (lento) | No (binario local) |

---

## Archivos modificados

- `backend/Dockerfile`: Variables ENV, CMD de inicio, HEALTHCHECK

---

## Contexto adicional: logging RAG para TFM

En este mismo sprint se mejoró el logging del sistema RAG para documentación de la memoria técnica del TFM:

- `backend/src/application/use-cases/chat-article.usecase.ts`: Logging detallado del proceso de recuperación de chunks (topK, score de similaridad, distancia coseno, fuente, título, longitud de contenido)
- `backend/src/infrastructure/external/pgvector.client.ts`: Logging detallado de la búsqueda vectorial con metadatos de cada documento recuperado
- **Motivo del cambio `console.log` → `console.info`**: Pino logger está configurado con nivel `info`, por lo que `console.log()` no aparece en la terminal. `console.info()` sí es capturado.

# Sprint 27.3 - Production Hotfixes + Responsive Mobile (2026-02-11)

**Estado**: ✅ Completado

## Objetivo
Estabilizar el despliegue en produccion (Render/Vercel) y corregir problemas de UI en movil.

## Cambios Backend
- Docker: imagen Debian `node:20-slim` para compatibilidad con `onnxruntime` (glibc).
- Prisma Client: copia del cliente generado en la etapa runner del Dockerfile.
- Dependencias: `node-cron` movido a `dependencies` para evitar `MODULE_NOT_FOUND` en prod.
- CORS: soporte para multiples dominios via `CORS_ORIGIN` con lista separada por comas.
- Local news: fallback seguro a `Madrid` si `location` no existe (evita crash en primer login).

## Cambios Frontend
- Recharts: tipado correcto del Tooltip para build en Vercel.
- Sidebar movil: drawer (Sheet) en lugar de sidebar fija.
- Header movil: menu en el header, busqueda en linea separada y full width.
- Search bar: boton con icono en movil + texto en desktop, mas espacio util.
- Footer: version compacta en movil y ocultar footer del home en mobile para evitar bloques densos.

## Entorno y Deploy
- Frontend: Vercel (preview + production).
- Backend: Render (Docker multi-stage).
- Variables claves: `CORS_ORIGIN` (multi-dominio), `NEXTAUTH_URL` (preview/prod).

## Verificacion
1. Login Google en preview y produccion.
2. Carga de noticias en movil sin CORS.
3. Header/search responsivo (input full width).
4. Footer compacto y sin bloque denso en mobile.

## Archivos principales
- `backend/Dockerfile`
- `backend/src/infrastructure/http/server.ts`
- `backend/src/infrastructure/http/controllers/news.controller.ts`
- `frontend/app/page.tsx`
- `frontend/components/layout/sidebar.tsx`
- `frontend/components/search-bar.tsx`
- `frontend/components/layout/footer.tsx`

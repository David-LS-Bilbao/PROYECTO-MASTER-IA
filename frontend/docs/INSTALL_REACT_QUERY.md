# 📦 Instalación de TanStack Query v5

## Comandos de Instalación

```bash
# Desde el directorio frontend/
cd frontend

# Instalar React Query v5 y DevTools
npm install @tanstack/react-query @tanstack/react-query-devtools
```

## ✅ Verificación

Después de instalar, tu `package.json` debe incluir:

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x.x",
    "@tanstack/react-query-devtools": "^5.x.x"
  }
}
```

## 🔄 Pasos Siguientes

1. **Instalar dependencias**: `npm install`
2. **Verificar configuración**: Los archivos ya están creados
   - `components/providers/query-provider.tsx` ✅
   - `hooks/useNews.ts` ✅
   - `hooks/useDashboardStats.ts` ✅
   - `app/layout.tsx` (modificado) ✅

3. **Ejecutar desarrollo**: `npm run dev`
4. **Verificar DevTools**: Abrir http://localhost:3001 → Ver icono React Query en esquina inferior

## 🛠️ Troubleshooting

### Error: "Cannot find module '@tanstack/react-query'"

**Solución:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### DevTools no aparecen en desarrollo

**Verificar:**
- `NODE_ENV=development` (debe estar en modo desarrollo)
- `process.env.NODE_ENV === 'development'` en `query-provider.tsx`
- Icono flotante en esquina inferior derecha del navegador

### Conflictos de versiones React

**Solución:**
```bash
# Asegurar compatibilidad con React 19
npm install @tanstack/react-query@latest @tanstack/react-query-devtools@latest
```

## 📚 Recursos Adicionales

- [Documentación TanStack Query v5](https://tanstack.com/query/latest)
- [Guía de Migración v4 → v5](https://tanstack.com/query/latest/docs/react/guides/migrating-to-v5)
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools)

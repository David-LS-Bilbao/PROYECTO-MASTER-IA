# Comandos de Recuperación - Frontend Turbopack

## Sprint 23.2: Resolución de Bloqueo de Persistencia

### Problema Diagnosticado
Turbopack falla al arrancar con el error:
```
Failed to open database
Caused by:
  0: Loading persistence directory failed
  1: invalid digit found in string
```

### Causa Raíz
Cache de compilación corrupto en el directorio de persistencia de Turbopack, posiblemente debido a:
- Interrupción abrupta del proceso Next.js
- Incompatibilidad entre versiones de Turbopack
- Cambios en estructura de archivos TypeScript durante hot-reload

---

## 🔧 Comandos de Recuperación (Windows PowerShell/CMD)

### Paso 1: Detener todos los procesos Node.js activos

```powershell
# Listar procesos Node.js
tasklist | findstr node.exe

# Matar todos los procesos Node (PRECAUCIÓN: mata TODOS los procesos Node)
taskkill /F /IM node.exe

# Alternativa: Matar solo el proceso del frontend (más seguro)
# Primero, identifica el PID con:
netstat -ano | findstr :3001
# Luego, mata ese PID específico:
taskkill /F /PID <PID_AQUI>
```

### Paso 2: Purgar artefactos de compilación

```powershell
cd "C:\Users\David\OneDrive\Desktop\PROYECTO MASTER IA\Verity-News\frontend"

# Eliminar directorio de build de Next.js
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# Eliminar cache de Turbopack (ubicado dentro de .next)
Remove-Item -Recurse -Force .next\cache -ErrorAction SilentlyContinue

# Eliminar cache de node_modules
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

# Eliminar cache de TypeScript
Remove-Item -Force tsconfig.tsbuildinfo -ErrorAction SilentlyContinue

# (OPCIONAL) Si persiste, eliminar node_modules y reinstalar
# Remove-Item -Recurse -Force node_modules
# npm install
```

### Paso 3: Verificar puertos libres

```powershell
# Verificar que el puerto 3001 esté libre
netstat -ano | findstr :3001

# Si el puerto está ocupado, matar el proceso:
# taskkill /F /PID <PID>
```

### Paso 4: Reiniciar servicios Docker (ChromaDB)

```powershell
cd "C:\Users\David\OneDrive\Desktop\PROYECTO MASTER IA\Verity-News"

# Verificar estado de contenedores
docker ps

# Si ChromaDB no responde, reiniciarlo
docker-compose restart chromadb

# Verificar logs
docker logs verity-news-chromadb --tail 20
```

### Paso 5: Reiniciar el frontend

```powershell
cd "C:\Users\David\OneDrive\Desktop\PROYECTO MASTER IA\Verity-News\frontend"

# Iniciar en modo desarrollo con Turbopack
npm run dev
```

---

## 🔧 Comandos de Recuperación (Git Bash)

### Alternativa para usuarios de Git Bash en Windows:

```bash
cd "/c/Users/David/OneDrive/Desktop/PROYECTO MASTER IA/Verity-News/frontend"

# Purgar cache
rm -rf .next
rm -rf node_modules/.cache
rm -f tsconfig.tsbuildinfo

# Reiniciar
npm run dev
```

---

## 🧪 Verificación Post-Recuperación

### 1. Verificar backend (debe estar corriendo primero)
```
http://localhost:3000/health
```
Respuesta esperada: `{ "status": "ok" }`

### 2. Verificar frontend
```
http://localhost:3001
```
Debe cargar la aplicación sin errores en consola.

### 3. Verificar ChromaDB
```bash
curl http://localhost:8000/api/v1
```
Respuesta esperada (deprecation warning es normal):
```json
{"error":"Unimplemented","message":"The v1 API is deprecated. Please use /v2 apis"}
```

---

## 🚨 Troubleshooting Adicional

### Si el error persiste después de purgar cache:

#### Opción 1: Deshabilitar Turbopack temporalmente
Edita `frontend/package.json`:
```json
"scripts": {
  "dev": "next dev -p 3001",  // Sin --turbopack
}
```

#### Opción 2: Limpiar completamente node_modules
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
npm run dev
```

#### Opción 3: Verificar versión de Next.js
```powershell
npm list next
```
Versión actual del proyecto: `16.1.6`

Si hay discrepancias, reinstalar:
```powershell
npm install next@latest react@latest react-dom@latest
```

---

## 📊 Diagnóstico del Error

### ¿Por qué ocurre este error?

1. **Turbopack Persistence Database**: Turbopack (el nuevo bundler de Next.js) mantiene una base de datos interna de caché para acelerar compilaciones incrementales.

2. **Corrupción de Datos**: Esta base de datos puede corromperse si:
   - El proceso Node.js se mata abruptamente (Ctrl+C durante escritura)
   - Hay cambios concurrentes en archivos TypeScript durante hot-reload
   - Conflictos de versión entre diferentes instancias de Turbopack

3. **"Invalid digit found in string"**: Indica que Turbopack intentó parsear un número desde un string en su base de datos interna, pero encontró caracteres no numéricos, señal de corrupción de datos.

### Prevención Futura

- Siempre detener el servidor con `Ctrl+C` (no `taskkill /F`)
- Evitar editar archivos mientras Turbopack está compilando (esperar al mensaje "compiled successfully")
- Purgar cache periódicamente: `rm -rf .next/cache`
- Considerar usar `next dev` sin `--turbopack` si el proyecto es pequeño (<1000 archivos)

---

**Última actualización**: Sprint 23.2 - 9 de febrero de 2026

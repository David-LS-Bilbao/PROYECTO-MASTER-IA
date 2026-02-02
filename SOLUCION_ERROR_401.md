# ⚠️ SOLUCIÓN: Error 401 Unauthorized en Perfil

## Problema
El backend no puede verificar el token JWT de Firebase porque **faltan las credenciales de Firebase Admin SDK**.

## Causa
El middleware de autenticación necesita Firebase Admin SDK para verificar tokens, pero no encuentra:
- ❌ Variables de entorno (`FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`)
- ❌ Archivo `backend/service-account.json`

## Solución

### Opción 1: Archivo service-account.json (Recomendado para desarrollo)

1. **Descargar credenciales desde Firebase Console:**
   - Ve a: https://console.firebase.google.com
   - Selecciona tu proyecto
   - Settings (⚙️) → Project Settings
   - Pestaña "Service accounts"
   - Click "Generate new private key"
   - Descarga el archivo JSON

2. **Guardar en el backend:**
   ```bash
   # Copiar el archivo descargado a:
   backend/service-account.json
   ```

3. **Reiniciar el backend:**
   ```bash
   cd backend
   npm run dev
   ```

### Opción 2: Variables de entorno (Producción)

Añadir a `backend/.env`:

```env
FIREBASE_PROJECT_ID=tu-proyecto-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
```

**NOTA:** La private key debe incluir `\n` literales para los saltos de línea.

## Verificación

Después de configurar las credenciales, verás en los logs del backend:

```
✅ Firebase Admin inicializado con proyecto: tu-proyecto-id
```

Y el endpoint `/api/user/me` funcionará correctamente.

## Endpoints Protegidos

Los siguientes endpoints requieren autenticación (header: `Authorization: Bearer <token>`):

- `POST /api/analyze/article` - Analizar artículo
- `GET /api/user/me` - Obtener perfil
- `PATCH /api/user/me` - Actualizar perfil

## Debugging

Para verificar que el token se está enviando correctamente, revisa los logs en la consola del navegador:

```
🔄 Cargando perfil del usuario...
✅ Token obtenido, llamando a getUserProfile...
📡 getUserProfile - Token length: 1234
📡 getUserProfile - Response status: 200 OK
```

Si ves `401 Unauthorized`, el problema está en el backend (credenciales faltantes).

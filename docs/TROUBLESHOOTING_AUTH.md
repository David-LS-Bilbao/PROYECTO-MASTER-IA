# Solución de Problemas: Error de Autenticación "Token inválido o expirado"

## Error

```
Token de autenticación inválido o expirado
Por favor, inicia sesión nuevamente
```

## Causa

Este error ocurre cuando:
1. El token JWT de Firebase ha expirado (tokens JWT tienen una vida útil de 1 hora)
2. El usuario no ha iniciado sesión correctamente
3. Hay un desajuste entre las configuraciones de Firebase del frontend y backend

## Soluciones

### 1. **Refrescar la Sesión (Solución Rápida)**

El sistema ahora intenta automáticamente refrescar el token cuando falla. Si aún así falla:

1. Cierra sesión en la aplicación
2. Vuelve a iniciar sesión
3. El problema debería resolverse

### 2. **Verificar Configuración de Firebase**

#### Backend (`backend/service-account.json`):
```json
{
  "project_id": "verity-news-4a798",
  ...
}
```

#### Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_FIREBASE_PROJECT_ID="verity-news-4a798"
```

**Ambos deben tener el mismo `project_id`.**

### 3. **Diagnosticar Firebase Admin**

Ejecuta el script de diagnóstico:

```bash
cd backend
npx tsx scripts/test-firebase-auth.ts
```

Deberías ver:
```
✅ Firebase Admin SDK está configurado correctamente
```

### 4. **Obtener un Token de Prueba**

Para debugging manual:

1. Inicia sesión en el frontend
2. Abre la consola del navegador (F12)
3. Ejecuta:
```javascript
auth.currentUser.getIdToken().then(token => {
  console.log('Token:', token);
  navigator.clipboard.writeText(token);
  console.log('✅ Token copiado al portapapeles');
});
```

4. Prueba el token con curl:
```bash
curl -X GET http://localhost:3000/api/user/me \
  -H "Authorization: Bearer <tu-token-aquí>"
```

### 5. **Logs de Debugging**

#### Frontend (Consola del navegador):
```
🔄 Cargando perfil del usuario...
✅ Token obtenido (renovado)
📡 getUserProfile - Token length: 1234
```

#### Backend (Terminal):
```
🔐 Verificando token con Firebase Admin...
✅ Token verificado correctamente. UID: abc123
✅ Usuario autenticado: user@example.com (abc123) - Plan: FREE
```

## Mejoras Implementadas

### Auto-Renovación de Tokens

El sistema ahora:
1. **Fuerza la renovación del token** al cargar la página de perfil
2. **Reintenta automáticamente** si falla la primera vez
3. **Muestra un mensaje claro** al usuario con opción de ir a login

```typescript
// AuthContext.tsx
const getToken = async (forceRefresh: boolean = false): Promise<string | null> => {
  const token = await currentUser.getIdToken(forceRefresh);
  // forceRefresh = true garantiza un token fresco
  return token;
}
```

### Manejo de Errores Mejorado

```typescript
// profile/page.tsx
try {
  let token = await getToken(true); // Renovar token
  const data = await getUserProfile(token);
} catch (error) {
  // Si falla, intentar una vez más
  const refreshedToken = await getToken(true);
  const data = await getUserProfile(refreshedToken);
}
```

## Preguntas Frecuentes

### ¿Por qué expiran los tokens?

Los tokens JWT de Firebase tienen una vida útil de **1 hora** por seguridad. Después de ese tiempo, necesitan renovarse.

### ¿Se renuevan automáticamente?

Sí, cuando el usuario está activo. Firebase SDK renueva automáticamente los tokens en segundo plano. Sin embargo, si el usuario cierra el navegador y vuelve después de 1 hora, necesita volver a iniciar sesión.

### ¿Cómo prevenir este error?

El código actual ya implementa:
- Auto-renovación al cargar páginas protegidas
- Reintento automático con token fresco
- Mensajes claros al usuario

Para evitar que el usuario tenga que volver a iniciar sesión:
- Mantén la pestaña del navegador abierta
- Firebase SDK renovará automáticamente los tokens

### ¿Qué pasa si cierro el navegador?

Firebase guarda la sesión en localStorage. Al volver a abrir:
- Si han pasado < 1 hora: sesión válida
- Si han pasado > 1 hora: necesitas volver a iniciar sesión

## Código de Referencia

### Middleware de Autenticación (Backend)

```typescript
// backend/src/infrastructure/http/middleware/auth.middleware.ts
export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  try {
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    req.user = { uid: decodedToken.uid, ... };
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Token de autenticación inválido o expirado'
    });
  }
}
```

### Contexto de Autenticación (Frontend)

```typescript
// frontend/context/AuthContext.tsx
const getToken = async (forceRefresh = false) => {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  
  return await currentUser.getIdToken(forceRefresh);
};
```

## Checklist de Verificación

- [ ] Firebase Admin SDK inicializado (`npx tsx scripts/test-firebase-auth.ts`)
- [ ] `service-account.json` existe en `backend/`
- [ ] `project_id` coincide entre frontend y backend
- [ ] Usuario ha iniciado sesión recientemente (< 1 hora)
- [ ] Backend está corriendo (`npm run dev`)
- [ ] Frontend está corriendo (`npm run dev`)
- [ ] No hay errores en la consola del backend
- [ ] No hay errores en la consola del navegador

## Contacto

Si el problema persiste después de seguir estos pasos, verifica:
1. Logs del backend (terminal donde corre `npm run dev`)
2. Logs del frontend (consola del navegador, F12)
3. Comparti los logs para debugging adicional

# Sprint 19.8 - Ajustes de Visualización (Fase 1)

## Nota
Este Sprint se completó en **dos fases**:
- **Fase 1 (Este documento):** Ajustes de visualización básicos (tema, fuente, densidad, reducir animaciones)
- **Fase 2 (Ver `Sprint-19.8-Accesibilidad.md`):** Mejoras de accesibilidad conforme a UNE-EN 301549/Ley 11/2023 (ancho de lectura, toggle ARIA, declaración legal, FIX tema)

## Objetivo
Implementar una página de configuración que permita a los usuarios personalizar la experiencia de lectura y accesibilidad de Verity News.

---

## Alcance

Esta página es **EXCLUSIVAMENTE** para personalizar la experiencia visual y de accesibilidad. La gestión de cuenta del usuario ya existe en la página de "Perfil".

---

## Características Implementadas

### 1. Hook de Preferencias (`usePreferences`)

**Archivo:** `frontend/hooks/usePreferences.ts`

#### Funcionalidad

- ✅ **Persistencia en localStorage**: Las preferencias se guardan automáticamente
- ✅ **Aplicación automática**: Se aplican al `document.documentElement` mediante clases CSS
- ✅ **Estado inicial**: Carga preferencias guardadas al montar
- ✅ **Sincronización**: Actualiza el DOM cuando cambian las preferencias

#### API del Hook

```typescript
const {
  preferences,      // Estado actual de preferencias
  isLoaded,        // Indica si se cargaron desde localStorage
  updateFontSize,  // (fontSize: FontSize) => void
  updateReduceMotion, // (reduceMotion: boolean) => void
  updateViewMode,  // (viewMode: ViewMode) => void
  resetToDefaults, // () => void
} = usePreferences();
```

#### Tipos

```typescript
type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type ViewMode = 'compact' | 'comfortable';

interface Preferences {
  fontSize: FontSize;
  reduceMotion: boolean;
  viewMode: ViewMode;
}
```

#### Valores Predeterminados

```typescript
{
  fontSize: 'base',        // 16px (normal)
  reduceMotion: false,     // Animaciones activas
  viewMode: 'comfortable', // Tarjetas grandes con imágenes
}
```

---

### 2. Página de Ajustes (`/settings`)

**Archivo:** `frontend/app/settings/page.tsx`

#### Secciones

##### A. 🎨 APARIENCIA

**1. Selector de Tema**
- ☀️ **Claro**: Tema claro
- 🌙 **Oscuro**: Tema oscuro
- 💻 **Sistema**: Sigue la preferencia del OS

**Implementación:**
- Usa `next-themes` (`useTheme` hook)
- Botones con iconos y estado activo
- Transición suave entre temas

**2. Densidad de Información**
- **Cómoda** (Default): Tarjetas grandes con imágenes
- **Compacta**: Listado denso, ideal para lectura rápida

**Estado:**
- ✅ Funcional (guarda preferencia)
- 🚧 Vista compacta: Próximamente (requiere modificar `NewsCard`)

##### B. 👁️ LECTURA Y ACCESIBILIDAD

**1. Tamaño de Fuente Base**
- **Pequeña (sm)**: 14px
- **Normal (base)**: 16px (Default)
- **Grande (lg)**: 18px
- **Muy Grande (xl)**: 20px

**Implementación:**
- 4 botones con vista previa del tamaño
- Vista previa en tiempo real con texto de ejemplo
- Aplica clase `theme-font-{size}` al `<html>`

**2. Reducir Animaciones**
- Toggle switch para desactivar transiciones y animaciones
- Útil para usuarios con sensibilidad al movimiento
- Aplica clase `reduce-motion` al `<html>`

##### C. 🧹 SISTEMA

**1. Borrar Caché de Noticias**
- Limpia caché de React Query (`queryClient.clear()`)
- Limpia localStorage de noticias (keys `news-*`, `article-*`)
- Toast de confirmación

**2. Restaurar Valores Predeterminados**
- Resetea todas las preferencias
- Establece tema en "Sistema"
- Toast de confirmación

---

### 3. Estilos Globales

**Archivo:** `frontend/app/globals.css`

#### Font Size Classes

```css
html.theme-font-sm {
  font-size: 14px;
}

html.theme-font-base {
  font-size: 16px; /* Default */
}

html.theme-font-lg {
  font-size: 18px;
}

html.theme-font-xl {
  font-size: 20px;
}
```

#### Reduce Motion

```css
html.reduce-motion *,
html.reduce-motion *::before,
html.reduce-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}
```

#### View Mode (Placeholder)

```css
html[data-view-mode="compact"] .news-card {
  /* Estilos para vista compacta */
  /* A implementar en NewsCard component */
}
```

---

### 4. Integración en Sidebar

**Archivo:** `frontend/components/layout/sidebar.tsx`

#### Cambio Realizado

**Antes:**
```tsx
<Button variant="ghost" ...>
  <Settings />
  {isOpen && <span>Ajustes</span>}
</Button>
```

**Después:**
```tsx
<Link href="/settings" ...>
  <Settings />
  {isOpen && <span>Ajustes</span>}
</Link>
```

**Posición:** Sección "Settings & User Profile" (encima del perfil de usuario)

---

## Cómo Funciona la Aplicación de Preferencias

### 1. Flujo de Aplicación

```
Usuario modifica ajuste
    ↓
usePreferences actualiza estado
    ↓
useEffect guarda en localStorage
    ↓
applyPreferencesToDocument() aplica clases al <html>
    ↓
CSS global reacciona a las clases
    ↓
Toda la app se actualiza visualmente
```

### 2. Clases Aplicadas al `<html>`

| Preferencia | Clase/Atributo | Efecto |
|-------------|----------------|--------|
| **fontSize: 'sm'** | `.theme-font-sm` | Base 14px |
| **fontSize: 'base'** | `.theme-font-base` | Base 16px |
| **fontSize: 'lg'** | `.theme-font-lg` | Base 18px |
| **fontSize: 'xl'** | `.theme-font-xl` | Base 20px |
| **reduceMotion: true** | `.reduce-motion` | Animaciones desactivadas |
| **viewMode: 'compact'** | `data-view-mode="compact"` | Vista compacta |

### 3. Ejemplo de DOM Resultante

```html
<!-- Usuario con fontSize: 'lg' y reduceMotion: true -->
<html class="theme-font-lg reduce-motion" data-view-mode="comfortable">
  <!-- Todo el contenido usa font-size base de 18px -->
  <!-- Todas las animaciones están desactivadas -->
</html>
```

---

## Testing Manual

### 1. Tamaño de Fuente

1. Navegar a [http://localhost:3001/settings](http://localhost:3001/settings)
2. Cambiar tamaño de fuente a "Grande"
3. ✅ Verificar vista previa cambia inmediatamente
4. Navegar a home `/`
5. ✅ Verificar todo el texto es más grande
6. Recargar página
7. ✅ Verificar preferencia persiste

### 2. Tema

1. Cambiar tema a "Oscuro"
2. ✅ Verificar interfaz cambia a modo oscuro
3. Cambiar a "Sistema"
4. ✅ Verificar sigue preferencia del OS

### 3. Reducir Animaciones

1. Activar "Reducir Animaciones"
2. Navegar por la app (scroll, hover, transiciones)
3. ✅ Verificar animaciones son instantáneas (sin transiciones suaves)

### 4. Borrar Caché

1. Visitar algunas noticias para llenar caché
2. Click en "Borrar Caché de Noticias"
3. ✅ Verificar toast de confirmación
4. Recargar página
5. ✅ Verificar datos se recargan desde servidor

### 5. Persistencia

1. Cambiar varios ajustes
2. Cerrar navegador
3. Abrir de nuevo y navegar a `/settings`
4. ✅ Verificar todas las preferencias se mantienen

---

## Archivos Creados

1. **`frontend/hooks/usePreferences.ts`** (NUEVO)
   - Hook de gestión de preferencias
   - Persistencia en localStorage
   - Aplicación automática al DOM

2. **`frontend/app/settings/page.tsx`** (NUEVO)
   - Página de ajustes completa
   - Interfaz con Cards por sección
   - Vista previa en tiempo real

3. **`docs/Sprint-19.8.md`** (NUEVO)
   - Documentación completa del sprint

---

## Archivos Modificados

1. **`frontend/app/globals.css`**
   - Agregados estilos de preferencias (font-size, reduce-motion)
   - +40 líneas de CSS

2. **`frontend/components/layout/sidebar.tsx`**
   - Botón "Ajustes" convertido a Link
   - Redirige a `/settings`

---

## Mejoras Futuras (Opcional)

### 1. Vista Compacta

**Tarea:** Implementar estilos compactos en `NewsCard`

```tsx
// En frontend/components/news-card.tsx
const isCompact = document.documentElement.getAttribute('data-view-mode') === 'compact';

return (
  <div className={cn(
    'news-card',
    isCompact ? 'compact-view' : 'comfortable-view'
  )}>
    {/* Contenido */}
  </div>
);
```

**Estilos compactos:**
- Imagen más pequeña (64x64px) o sin imagen
- Padding reducido
- Tipografía más densa
- Layout horizontal (imagen a la izquierda, contenido a la derecha)

### 2. Más Opciones de Fuente

- **Familia de fuente**: Serif vs Sans-serif
- **Espaciado de línea**: Compacto, Normal, Amplio
- **Ancho de columna**: Estrecho, Normal, Amplio

### 3. Preferencias por Página

- Guardar preferencias específicas por tipo de contenido
- Ej: Tamaño de fuente diferente para artículos largos

### 4. Exportar/Importar Configuración

- Exportar preferencias a JSON
- Importar desde archivo
- Útil para sincronizar entre dispositivos

---

## Integración con Layout Root (Opcional)

### Aplicación Automática en Layout

Si quieres que las preferencias se apliquen **antes** del primer render (evitando flash de contenido), agrega esto a `frontend/app/layout.tsx`:

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Script inline para aplicar preferencias ANTES del render */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const prefs = JSON.parse(localStorage.getItem('verity-news-preferences') || '{}');
                  if (prefs.fontSize) {
                    document.documentElement.classList.add('theme-font-' + prefs.fontSize);
                  }
                  if (prefs.reduceMotion) {
                    document.documentElement.classList.add('reduce-motion');
                  }
                  if (prefs.viewMode) {
                    document.documentElement.setAttribute('data-view-mode', prefs.viewMode);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {/* ... resto del layout */}
      </body>
    </html>
  );
}
```

**Ventajas:**
- ✅ Sin flash de contenido (FOUC)
- ✅ Preferencias aplicadas instantáneamente
- ✅ Mejor UX en primera carga

**Nota:** El `usePreferences` hook ya aplica las preferencias correctamente después del mount, pero este script evita el flash inicial.

---

## Accesibilidad (WCAG 2.1)

### Cumplimiento

| Criterio | Estado | Notas |
|----------|--------|-------|
| **1.4.4 Resize Text** | ✅ | Texto escalable hasta 200% |
| **2.3.3 Animation from Interactions** | ✅ | Toggle "Reducir Animaciones" |
| **1.4.12 Text Spacing** | ✅ | `rem` units respetan user agent |
| **2.4.7 Focus Visible** | ✅ | Outline visible en todos los controles |

### Keyboard Navigation

- ✅ Todos los controles accesibles por teclado
- ✅ Tab order lógico
- ✅ Enter/Space activan controles

### Screen Readers

- ✅ Labels descriptivos en todos los controles
- ✅ Toggle switch con `role="switch"` y `aria-checked`
- ✅ Feedback con toasts (sonner tiene soporte ARIA)

---

## Métricas de Éxito

| Métrica | Objetivo |
|---------|----------|
| **Adopción** | 30% usuarios modifican al menos 1 ajuste |
| **Retención** | 80% mantienen preferencias personalizadas |
| **Accesibilidad** | 15% usuarios usan "Reducir Animaciones" |
| **Font Size** | 10% usuarios aumentan tamaño de fuente |

---

## Conclusión

Sprint 19.8 implementa una página de **Ajustes de Visualización** completa que:

1. ✅ **Personaliza la experiencia**: Tema, fuente, densidad, animaciones
2. ✅ **Mejora accesibilidad**: Tamaño de fuente, reducción de movimiento
3. ✅ **Persiste preferencias**: localStorage con sincronización automática
4. ✅ **Interfaz intuitiva**: Feedback visual inmediato, vista previa en tiempo real

**El sistema permite a cada usuario adaptar Verity News a sus necesidades específicas.**

**Status:** Sprint 19.8 (Fase 1) completado - Ajustes de visualización funcionales ✅

**Ver también:** `Sprint-19.8-Accesibilidad.md` para la Fase 2 (UNE-EN 301549)

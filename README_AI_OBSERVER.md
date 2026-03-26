# README · AI Observer

## Descripción
AI Observer es la capa de observabilidad de inteligencia artificial del proyecto. Su objetivo es registrar, medir y auditar el comportamiento de las operaciones de IA que ejecuta la aplicación, de forma que se pueda analizar qué modelo se usó, qué prompt se ejecutó, cuánto costó, cuántos tokens consumió y cuál fue el resultado operativo.

No forma parte de la lógica de producto visible para el usuario final. Su función es transversal: aportar trazabilidad, control de costes, debugging y capacidad de auditoría sobre el uso de modelos de IA dentro del sistema.

---

## Objetivos

- Registrar cada ejecución relevante de IA.
- Versionar y relacionar prompts con las operaciones que los usan.
- Asociar precios y consumo de tokens a cada modelo.
- Facilitar análisis de costes, rendimiento y errores.
- Servir como base para auditoría técnica y mejora continua.

---

## Alcance funcional
AI Observer cubre principalmente estas áreas:

### 1. Registro de ejecuciones de IA
Cada operación relevante puede generar un registro con información como:

- identificador de ejecución
- tipo de operación
- proveedor y modelo utilizados
- prompt o versión de prompt asociada
- tokens de entrada y salida
- coste estimado
- duración
- estado final
- error, si existe

### 2. Versionado de prompts
Permite mantener trazabilidad entre una ejecución y el prompt exacto que la produjo. Esto es importante para:

- comparar cambios de comportamiento
- auditar regresiones
- reproducir resultados
- validar mejoras en prompts

### 3. Gestión de precios por modelo
Permite almacenar el coste por modelo para estimar o calcular el gasto de cada operación.

### 4. Agregación y análisis
A partir de los registros individuales se pueden construir métricas agregadas:

- coste por día
- coste por modelo
- uso por operación
- tokens consumidos
- ratio de error
- operaciones más caras

---

## Valor técnico
AI Observer aporta varias ventajas al proyecto:

- **Observabilidad real** sobre el uso de IA.
- **Control económico** del consumo de modelos.
- **Capacidad de auditoría** para memoria, defensa o revisión técnica.
- **Base para optimización**, ya que permite detectar prompts caros, modelos sobredimensionados o fallos frecuentes.
- **Separación de responsabilidades**, al no mezclar observabilidad con la lógica de dominio.

---

## Arquitectura conceptual
La arquitectura de AI Observer puede entenderse así:

1. Un componente del sistema solicita una operación de IA.
2. Se resuelve qué prompt y qué modelo deben usarse.
3. Se ejecuta la llamada al proveedor de IA.
4. AI Observer registra la ejecución.
5. Se calculan o asocian tokens, precio y coste.
6. Los datos quedan disponibles para análisis posterior.

---

## Componentes principales
Según la auditoría previa del proyecto, las piezas clave relacionadas con AI Observer son estas:

- `ai-observability.service.ts`
- `prompt-registry.service.ts`
- `token-and-cost.service.ts`
- componentes cliente que disparan operaciones con IA
- definición de modelos y precios
- almacenamiento asociado a observabilidad

Estas piezas permiten conectar el uso real de IA con una capa de registro y análisis centralizada.

---

## Casos de uso

### Auditoría de coste
Permite responder preguntas como:

- cuánto ha costado un flujo de análisis
- qué modelo es más caro
- qué operación consume más tokens

### Revisión de prompts
Permite comprobar:

- qué prompt produjo un resultado concreto
- si una nueva versión mejora o empeora el comportamiento
- si un cambio de prompt incrementa el coste

### Troubleshooting
Permite investigar:

- por qué una operación falló
- si el error está asociado a un modelo concreto
- si hay latencias anómalas

### Defensa académica o memoria
Permite documentar de forma sólida:

- que el sistema no usa IA como caja negra sin control
- que existe trazabilidad sobre prompts, modelos y costes
- que la solución está preparada para escalar con criterio técnico

---

## Flujo de datos resumido

```text
Módulo funcional -> Cliente IA -> Prompt Registry -> Proveedor IA
                                -> AI Observer -> Cost/Token Service -> Persistencia
```

---

## Buenas prácticas
Para mantener AI Observer útil y sostenible, conviene seguir estas prácticas:

- registrar solo operaciones realmente relevantes
- no mezclar secretos ni datos sensibles en logs
- versionar prompts cuando cambie su comportamiento
- mantener actualizado el catálogo de precios por modelo
- revisar periódicamente métricas de coste y error

---

## Limitaciones actuales
Dependiendo del estado exacto de la rama o del entorno, pueden existir limitaciones como:

- cobertura parcial de operaciones observadas
- diferencias entre coste estimado y coste real facturado
- métricas aún no expuestas en una UI administrativa
- necesidad de ampliar paneles o endpoints de consulta

---

## Futuras mejoras
Algunas mejoras naturales para esta parte serían:

- panel visual de observabilidad IA
- filtros por operación, modelo y rango temporal
- comparativa entre versiones de prompt
- alertas por coste o error anómalo
- exportación de métricas para reporting

---

## Resumen
AI Observer es la infraestructura de observabilidad de IA del proyecto. Su misión es aportar trazabilidad, control de costes, auditoría y capacidad de análisis sobre todas las operaciones que usan modelos de inteligencia artificial. Es una pieza técnica clave para profesionalizar el uso de IA dentro del sistema y hacer el comportamiento del proyecto más medible, mantenible y defendible.

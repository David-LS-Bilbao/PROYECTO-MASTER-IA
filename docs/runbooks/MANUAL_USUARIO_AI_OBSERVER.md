# Manual Rapido de Usuario - AI Observer

## 1. Objetivo

AI Observer es el panel interno de observabilidad IA de Verity. Su ruta es:

- `http://localhost:3001/admin/ai-usage`

Desde esa pantalla puedes ver, en una sola vista, el uso de IA de:

- Verity
- Media Bias Atlas (MBA)

El panel agrega runs, tokens, coste, latencia, prompts versionados, errores y comparativas.

## 2. Requisitos previos

Antes de probar el panel, verifica que estos servicios esten activos:

- Verity frontend: `http://localhost:3001`
- Verity backend: `http://localhost:3000`
- MBA frontend: `http://localhost:3004`
- MBA backend: `http://localhost:3002`

Acceso:

- En un entorno normal necesitas sesion iniciada en Verity.
- En local tambien puede funcionar con bypass de desarrollo si esta habilitado.

## 3. Prueba rapida en 5 minutos

1. Abre `http://localhost:3001/admin/ai-usage`.
2. Confirma que aparecen dos tarjetas de fuente:
   - `Verity -> Fuente disponible`
   - `Media Bias Atlas -> Fuente disponible`
3. Si la pantalla esta vacia, genera trafico real:
   - en Verity, analiza una noticia y usa el chat
   - en MBA, analiza el sesgo de un feed
4. Pulsa `Refrescar`.
5. Verifica que ya existen runs en la tabla y que salen datos de ambos sistemas.

Importante:

- AI Observer solo muestra metricas nuevas cuando hay una invocacion IA real
- si la aplicacion reutiliza un analisis ya existente o cacheado, no se crea un run nuevo

## 4. Que muestra cada bloque

### Filtros operativos

Sirven para acotar la vista por:

- rango de fechas
- modulo
- operacion
- provider
- modelo
- estado

Uso recomendado:

- empieza sin filtros
- luego filtra por `modulo`
- despues filtra por `operacion`

### Tarjetas de fuente

Muestran si cada backend responde correctamente:

- `Verity`
- `Media Bias Atlas`

Si una fuente falla, la pagina puede seguir funcionando en modo parcial.

### Resumen superior

Resume el periodo filtrado con estas metricas:

- total de runs
- total de tokens conocidos
- coste estimado conocido
- runs con error

Nota:

- si un proveedor no devuelve tokens o coste reales, la UI no inventa esos valores

### Distribuciones

Hay tres bloques de lectura rapida:

- distribucion por modulo
- distribucion por operacion
- distribucion por provider y modelo

Te sirven para detectar rapidamente donde se esta concentrando el uso.

### Tabla de ejecuciones

Es la vista mas util para inspeccion manual. Cada fila muestra:

- fecha
- modulo
- operacion
- provider
- modelo
- estado
- tokens
- coste
- latencia
- request/correlation id
- entidad

Accion clave:

- pulsa `Ver` para abrir el detalle lateral del run

### Detalle lateral del run

Permite validar:

- metadatos operativos
- prompt version asociado
- error persistido, si existe
- `metadataJson` saneado

No expone prompts interpolados completos ni respuestas completas del modelo.

### Catalogo de prompts

Lista las versiones registradas de prompt. Puedes comprobar:

- modulo
- `promptKey`
- version
- hash
- fichero fuente
- si esta activo
- numero de runs
- ultimo uso

Incluye filtros rapidos:

- `Todos`
- `Activos`
- `Inactivos`

### Errores recientes

Muestra los ultimos runs fallidos, cancelados o con timeout dentro del rango actual.

### Comparadores

Hay cuatro comparadores agregados:

- por modulo
- por operacion
- por provider
- por modelo

Cada uno muestra runs, tokens medios, coste medio, latencia media y tasa de error.

## 5. Como generar datos reales para probar el panel

### Verity

Estas acciones suelen generar datos visibles en AI Observer:

1. Analisis de noticia
   - abre `http://localhost:3001`
   - entra en una noticia
   - ejecuta el analisis IA de la noticia
   - deberias ver al menos `article_analysis`

2. Chat sobre una noticia
   - desde la ficha de una noticia abre el chat
   - haz una pregunta sobre el contenido
   - deberias ver `rag_chat`
   - tambien puede aparecer `embedding_generation`

3. Chat general
   - abre el chat general desde la home o desde una noticia
   - haz una consulta abierta
   - deberias ver `general_chat_grounding`

Observacion:

- `embedding_generation` puede aparecer varias veces porque se usa como paso auxiliar en algunos flujos
- `json_repair`, `rss_discovery` y `local_source_discovery` no siempre son faciles de provocar manualmente en una prueba corta
- si `GEMINI_API_KEY` no es una clave valida en tu entorno local, Verity no generara runs reales aunque la UI cargue

### Media Bias Atlas

La forma mas fiable de generar observabilidad en MBA es esta:

1. Abre `http://localhost:3004`
2. Entra en un pais, por ejemplo `US`
3. Abre un outlet
4. Abre uno de sus feeds
5. Pulsa `Analizar sesgo`

Resultado esperado:

- se crean runs con `module = media-bias-atlas`
- la operacion visible sera `article_bias_analysis`

Importante:

- si el articulo no es politico o no llega a invocar IA real, puede no crearse run
- el analisis por feed genera trazabilidad por articulo, no un unico run agregado
- si el articulo ya tenia un analisis completado y la API responde con reutilizacion del resultado existente, tampoco se crea un run nuevo
- para pruebas fiables, usa un articulo politico todavia no analizado o resetea el analisis previo en un entorno de test

## 6. Checklist funcional recomendado

Usa esta lista para una validacion manual completa:

1. Abrir `/admin/ai-usage` y confirmar que ambas fuentes estan disponibles.
2. Ejecutar al menos una accion IA en Verity.
3. Ejecutar al menos una accion IA en MBA.
4. Pulsar `Refrescar`.
5. Verificar que `Total de runs` es mayor que `0`.
6. Verificar que en `Distribucion por modulo` aparecen `verity` y `media-bias-atlas`.
7. Filtrar por `modulo = media-bias-atlas` y comprobar que la tabla solo muestra runs de MBA.
8. Filtrar por `modulo = verity` y comprobar que la tabla solo muestra runs de Verity.
9. Abrir un run con `Ver` y revisar `requestId`, `correlationId`, entidad y `Prompt version`.
10. Entrar en `Catalogo de prompts` y comprobar que hay versiones registradas y ultimo uso.
11. Revisar `Comparador por operacion` para confirmar que latencia, coste y error rate tienen sentido.
12. Quitar todos los filtros y comprobar que la vista vuelve al agregado completo.

## 7. Casos concretos que deberias ver

En Verity es razonable encontrar operaciones como:

- `article_analysis`
- `rag_chat`
- `general_chat_grounding`
- `embedding_generation`

En MBA es razonable encontrar:

- `article_bias_analysis`

En el catalogo de prompts puedes encontrar claves como:

- Verity: `RAG_CHAT_PROMPT`, `GROUNDING_CHAT_PROMPT`, `GENERAL_CHAT_SYSTEM_PROMPT`
- MBA: `article_bias_prompt`, `article_bias_instructions`, `article_bias_input_context`

## 8. Troubleshooting rapido

Si la pantalla sale vacia:

- pulsa `Refrescar`
- limpia filtros
- genera trafico IA real en Verity o MBA
- comprueba que no estas reutilizando resultados ya analizados
- revisa si las tablas `ai_operation_runs` siguen vacias

Si MBA no aparece como disponible:

- comprueba `http://localhost:3002/health`
- comprueba `http://localhost:3004`
- revisa que `AI_USAGE_MBA_API_URL` apunte al backend correcto

Si Verity no aparece como disponible:

- comprueba `http://localhost:3000/health`
- revisa que el backend este levantado

Si ves runs pero sin tokens o sin coste:

- puede ser normal
- depende de que el proveedor devuelva metricas reales

Si ambas fuentes aparecen disponibles pero el total sigue en `0`:

- AI Observer esta funcionando, pero no hay runs persistidos todavia
- esto suele pasar cuando:
  - aun no has lanzado ningun flujo IA real en esta maquina
  - Verity tiene una clave IA local invalida o desactivada
  - MBA esta reutilizando analisis ya completados en lugar de invocar IA de nuevo

Si quieres validar degradacion controlada en local:

- deten temporalmente uno de los backends
- vuelve a cargar AI Observer
- deberias seguir viendo la otra fuente operativa y una tarjeta avisando de la fuente caida

## 9. Resultado esperado de una prueba correcta

La prueba se puede dar por buena cuando se cumple esto:

- AI Observer abre sin error
- las dos fuentes aparecen disponibles
- hay runs de Verity y de MBA
- los filtros responden bien
- el detalle lateral abre correctamente
- el catalogo de prompts muestra versiones reales
- los comparadores muestran datos agregados coherentes

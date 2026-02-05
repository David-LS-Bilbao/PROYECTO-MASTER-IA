# Sprint 16: Optimización de Feeds RSS y Capacidad de Carga

## Problema Identificado
- La categoría **deportes** mostraba artículos de hace 9 horas sin actualizarse
- Solo se ingresaban 5 artículos por categoría (límite muy bajo)
- 9 de 10 feeds RSS de deportes estaban rotos (404/410/obsoletos)
- Feeds de portada también tenían URLs rotas
- pageSize de auto-ingesta (20) menor que limit del frontend (50)

## Cambios Implementados

### 1. Feeds RSS de Deportes Actualizados
**Archivo**: `backend/src/infrastructure/external/direct-spanish-rss.client.ts` (líneas 50-60)

**Antes**: 10 fuentes (9 rotas)
**Ahora**: 8 fuentes funcionales verificadas

- Marca: 68 artículos ✅
- Mundo Deportivo: 149 artículos ✅ (URL corregida)
- Sport: 50 artículos ✅ (URL corregida)
- ABC Deportes: 25 artículos ✅
- La Vanguardia Deportes: 100 artículos ✅
- El Español Deportes: 30 artículos ✅
- El País Deportes: 29 artículos ✅
- 20 Minutos Deportes: 26 artículos ✅

### 2. Feeds RSS de Portada (General) Actualizados
**Archivo**: `backend/src/infrastructure/external/direct-spanish-rss.client.ts` (líneas 22-34)

**Cambios**:
- La Vanguardia: URL corregida (home.xml en lugar de mvc/feed/rss/home)
- La Razón: Reemplazada por Europa Press (feed roto 406)
- Público: Reemplazada por Voz Pópuli (feed roto 404)

**Resultado**: 10 fuentes de portadas principales de medios españoles, todas funcionales

### 3. Límite de Ingesta Aumentado
**Archivo**: `backend/src/application/use-cases/ingest-news.usecase.ts` (línea 23)

**Antes**: `MAX_ITEMS_PER_SOURCE = 5`
**Ahora**: `MAX_ITEMS_PER_SOURCE = 30`

**Beneficio**: Permite ingerir hasta 30 artículos nuevos por categoría en lugar de solo 5

### 4. Balanceo de Fuentes RSS
**Archivo**: `backend/src/infrastructure/external/direct-spanish-rss.client.ts` (líneas 250-277)

**Cambio**: Algoritmo de agregación modificado para tomar N artículos de CADA fuente, no solo los N más recientes globalmente

**Antes**:
- Tomaba todos los artículos de todas las fuentes
- Los ordenaba por fecha globalmente
- Seleccionaba los 20 más recientes
- **Problema**: Una fuente muy activa (Sport) dominaba la ingesta

**Ahora**:
- Calcula `articlesPerSource = Math.max(2, Math.ceil(pageSize / numFuentes))`
- Toma N artículos de cada fuente individualmente
- Luego los ordena por fecha
- **Beneficio**: Garantiza diversidad de fuentes

**Distribución por categoría con pageSize=50**:
- general (10 fuentes): 5 artículos/fuente → ~50 artículos
- economia (10 fuentes): 5 artículos/fuente → ~50 artículos
- deportes (8 fuentes): 7 artículos/fuente → ~56 artículos
- tecnologia (10 fuentes): 5 artículos/fuente → ~50 artículos
- ciencia (8 fuentes): 7 artículos/fuente → ~56 artículos
- politica (8 fuentes): 7 artículos/fuente → ~56 artículos
- internacional (4 fuentes): 13 artículos/fuente → ~52 artículos
- cultura (4 fuentes): 13 artículos/fuente → ~52 artículos

### 5. PageSize de Auto-Ingesta Aumentado
**Archivo**: `frontend/app/page.tsx` (línea 163)

**Antes**: `pageSize: 20`
**Ahora**: `pageSize: 50`

**Beneficio**: Coincide con el `limit: 50` que el frontend solicita posteriormente, asegurando que haya suficientes artículos frescos en la base de datos

## Resultados

### Deportes (Antes vs Ahora)
| Métrica | Antes | Ahora | Mejora |
|---------|-------|-------|--------|
| Total artículos | 29 | 73 | +151% |
| Fuentes activas | 1 (solo Marca) | 8 fuentes | +700% |
| Antigüedad | 10-32h | 0h (tiempo real) | Tiempo real |
| Diversidad | Nula | Sport (26), Marca (20), MD (12), otros | Excelente |

### Portada 
- 10 fuentes principales de portadas de medios españoles
- Mix ideológico representativo (El País, El Mundo, ABC, etc.)
- Feeds verificados y funcionales (Feb 2026)

## Archivos de Test Creados
- `backend/test-rss-feeds.ts` - Test de feeds RSS
- `backend/test-alternative-feeds.ts` - Búsqueda de feeds alternativos
- `backend/check-deportes.ts` - Verificación de artículos en BD
- `backend/check-deportes-distribution.ts` - Distribución de fuentes
- `backend/test-portada-feeds.ts` - Test de feeds de portada  
- `backend/test-alternative-portada.ts` - Búsqueda de portadas alternativas
- `backend/analyze-categories.ts` - Análisis de capacidad por categoría

## Próximos Pasos Recomendados
1. Monitorear la ingesta de todas las categorías durante unos días
2. Verificar que los feeds de portada proveen contenido relevante y de calidad
3. Considerar aumentar MAX_ITEMS_PER_SOURCE si se requiere más cobertura
4. Implementar healthcheck automático de feeds RSS para detectar feeds rotos proactivamente

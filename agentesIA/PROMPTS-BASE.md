# PROMPTS-BASE.md — Lote inicial para Antigravity y Codex

## 1. Auditoría inicial del repo
Actúa como arquitecto de software senior. Analiza el repositorio actual de Verity News y entrega:
1) módulos reutilizables para Media Bias Atlas,
2) piezas de ingesta RSS existentes o similares,
3) piezas de análisis IA reutilizables,
4) riesgos de acoplamiento,
5) propuesta de arquitectura del nuevo MVP.
No programes todavía.

## 2. Estrategia de base de datos
Propón la estrategia de persistencia para Media Bias Atlas desplegado en el mismo VPS que Verity News.
Compara:
- misma base con tablas nuevas,
- nuevo esquema,
- nueva base en el mismo PostgreSQL.
Recomienda una opción y justifica trade-offs de mantenibilidad, despliegue y seguridad.

## 3. Modelo Prisma inicial
Crea el esquema Prisma mínimo para:
- Country
- Outlet
- RssFeed
- Article
- ArticleBiasAnalysis
- OutletBiasProfile
- IngestRun
Incluye relaciones y campos mínimos para MVP.
No añadas campos especulativos.

## 4. Alta manual de medio
Implementa el backend mínimo para registrar un nuevo medio con:
- país,
- nombre,
- dominio,
- idioma,
- uno o varios feeds RSS.
Entrega:
- caso de uso,
- validador,
- controlador/route,
- test básico.

## 5. Ingesta RSS MVP
Implementa un servicio de ingesta que:
- recorra feeds activos,
- consulte artículos nuevos,
- descarte duplicados por URL,
- guarde artículos básicos,
- marque topic detectado.
No implementes todavía análisis IA si no es necesario para cerrar el flujo.

## 6. Filtro político
Implementa una primera versión del filtro político:
- heurística por keywords,
- estructura preparada para validación IA posterior,
- tests de casos positivos y negativos.

## 7. Cálculo de perfil ideológico
Implementa un servicio que calcule el perfil ideológico agregado de un medio a partir de sus análisis de artículos:
- media ponderada,
- etiqueta ideológica,
- tamaño de muestra,
- confianza simple.
Entrega también criterios explícitos de cálculo.

## 8. UI MVP
Crea la UI mínima con estas pantallas:
- países,
- medios por país,
- ficha del medio,
- alta manual.
Prioriza claridad, no diseño complejo.

## 9. ADR inicial
Escribe un ADR corto para justificar por qué Media Bias Atlas debe desplegarse en el mismo VPS que Verity News pero como servicio separado.

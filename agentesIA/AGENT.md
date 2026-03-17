# AGENT.md — Media Bias Atlas

## Misión
Construir un MVP paralelo a Verity News para analizar el sesgo ideológico agregado de medios de comunicación a partir de noticias políticas ingeridas por RSS.

## Contexto
Verity News ya utiliza una arquitectura limpia/hexagonal con backend Node/TypeScript, frontend Next.js, PostgreSQL, vector DB, testing con Vitest y despliegue con Docker. El nuevo proyecto debe reutilizar lo máximo razonable de esa base sin acoplar mal los dominios. fileciteturn3file0

## Regla principal
Reutilizar infraestructura y patrones, pero desplegar Media Bias Atlas como producto separado.

## Alcance MVP
- 3 a 5 países
- 5 medios por país
- alta manual de medios
- ingesta RSS
- filtro político
- análisis por noticia
- agregación por medio
- panel básico

## Restricciones
- no romper Verity News
- no hacer reescrituras globales
- no sobreingenierizar
- no introducir microservicios al inicio
- no mezclar demasiados cambios en una sola iteración

## Entregables técnicos mínimos
- modelo de datos inicial
- servicio de alta de medios
- ingesta básica
- cálculo agregado
- UI simple de demo
- documentación y ADRs básicos
# Migración de ChromaDB a pgvector

## Resumen

Este proyecto ha migrado desde ChromaDB (base de datos vectorial externa) a **pgvector** (extensión PostgreSQL) para consolidar toda la infraestructura de almacenamiento en una sola base de datos.

## Beneficios de la Migración

1. **Simplicidad**: Una sola base de datos (PostgreSQL) en lugar de dos (PostgreSQL + ChromaDB)
2. **Menor latencia**: No hay comunicación entre servicios externos
3. **Transacciones atómicas**: Embeddings y datos relacionales en la misma transacción
4. **Menor coste**: No requiere servicio adicional de ChromaDB
5. **Mejor mantenibilidad**: Un solo sistema para gestionar (backups, scaling, etc.)

## Cambios Realizados

### 1. Schema de Prisma
- Habilitada la extensión `pgvector` en el datasource
- Campo `embedding` cambiado de `String @db.Text` a `Unsupported("vector(768)")`
- Tipo vector con 768 dimensiones (Gemini text-embedding-004)

### 2. Código Refactorizado

**Interfaces:**
- `IChromaClient` → `IVectorClient` (interfaz genérica)

**Implementaciones:**
- `ChromaClient` → `PgVectorClient`
- Usa consultas SQL raw con operador de distancia coseno `<=>`

**Use Cases actualizados:**
- `AnalyzeArticleUseCase`
- `SearchNewsUseCase`
- `ChatArticleUseCase`
- `ChatGeneralUseCase`

**Dependency Container:**
- `chromaClient: ChromaClient` → `vectorClient: PgVectorClient`

### 3. Migración SQL
- Archivo: `prisma/migrations/20260211_enable_pgvector/migration.sql`
- Habilita extensión `vector`
- Crea campo `embedding` como `vector(768)`
- Crea índice HNSW para búsquedas rápidas

## Pasos para Aplicar la Migración

### 1. Instalar pgvector en PostgreSQL

**Para PostgreSQL local:**
```bash
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# macOS (Homebrew)
brew install pgvector

# Windows
# Descargar desde: https://github.com/pgvector/pgvector/releases
```

**Para Neon Serverless Postgres:**
- La extensión pgvector ya está disponible automáticamente
- No requiere instalación adicional

### 2. Desinstalar ChromaDB (opcional)
```bash
cd backend
npm uninstall chromadb @chroma-core/default-embed
```

### 3. Aplicar Migración de Prisma
```bash
cd backend
npx prisma migrate deploy
```

### 4. Regenerar Cliente de Prisma
```bash
npx prisma generate
```

### 5. Verificar la Migración
```bash
# Verificar que la extensión está habilitada
npx prisma db execute --stdin <<< "SELECT extname FROM pg_extension WHERE extname = 'vector';"

# Verificar que el índice se creó
npx prisma db execute --stdin <<< "SELECT indexname FROM pg_indexes WHERE tablename = 'articles' AND indexname LIKE '%embedding%';"
```

### 6. Re-indexar Artículos Existentes (si es necesario)

Si tienes artículos ya analizados, ejecuta el script de backfill:
```bash
ts-node scripts/backfill-embeddings.ts
```

Este script:
1. Busca artículos con `analyzedAt != null` pero `embedding = null`
2. Regenera embeddings para cada artículo
3. Los almacena en pgvector

## Verificación de Funcionamiento

### Test de Búsqueda Semántica
```bash
# Prueba la búsqueda semántica
ts-node scripts/test-search-endpoint.ts
```

### Test de Embedding Flow
```bash
# Prueba el flujo completo de embeddings
ts-node scripts/test-embedding-flow.ts
```

## Rollback (si es necesario)

Si necesitas volver a ChromaDB:

1. Revertir la migración:
```bash
npx prisma migrate reset
```

2. Reinstalar ChromaDB:
```bash
npm install chromadb@^3.3.0 @chroma-core/default-embed@^0.1.9
```

3. Restaurar código desde el commit previo a la migración

## Notas Importantes

- **Dimensión de embeddings**: Gemini text-embedding-004 genera vectores de **768 dimensiones**
- **Índice HNSW**: Más eficiente que IVFFlat para la mayoría de casos de uso
- **Distancia coseno**: Usamos el operador `<=>` para búsquedas de similitud
- **Performance**: pgvector es comparable a ChromaDB en velocidad para volúmenes < 1M vectores

## Soporte

Si encuentras problemas durante la migración:
1. Verifica que PostgreSQL >= 12 (pgvector requiere PG 12+)
2. Verifica que la extensión pgvector esté instalada
3. Revisa los logs de Prisma durante la migración
4. Consulta la documentación de pgvector: https://github.com/pgvector/pgvector

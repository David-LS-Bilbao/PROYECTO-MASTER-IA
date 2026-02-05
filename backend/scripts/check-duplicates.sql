-- Script de verificación de duplicados
-- Ejecutar con: npx prisma db execute --file ./scripts/check-duplicates.sql --schema ./prisma/schema.prisma

-- ==========================================
-- 1. URLs duplicadas (NO debería haber ninguna por el constraint)
-- ==========================================
SELECT url, COUNT(*) as count
FROM articles
GROUP BY url
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- ==========================================
-- 2. Artículos por categoría (distribución)
-- ==========================================
SELECT 
  category,
  COUNT(*) as total_articles,
  COUNT(DISTINCT url) as unique_urls
FROM articles
GROUP BY category
ORDER BY total_articles DESC;

-- ==========================================
-- 3. Artículos con títulos muy similares (posibles duplicados semánticos)
-- ==========================================
SELECT 
  a1.id as id1,
  a2.id as id2,
  a1.url as url1,
  a2.url as url2,
  a1.title,
  a1.category as cat1,
  a2.category as cat2,
  a1."publishedAt"
FROM articles a1
JOIN articles a2 ON a1.title = a2.title AND a1.id < a2.id
ORDER BY a1."publishedAt" DESC
LIMIT 50;

-- ==========================================
-- 4. URLs que deberían estar en múltiples categorías
-- ==========================================
-- (Por ahora, mostrar artículos recientes para análisis manual)
SELECT url, title, category, "publishedAt"
FROM articles
WHERE "publishedAt" > NOW() - INTERVAL '24 hours'
ORDER BY "publishedAt" DESC
LIMIT 100;

-- ============================================
-- Script de Verificación: Categorías Independientes
-- Objetivo: Validar que "General" NO se mezcla con otras categorías
-- ============================================

-- ============================================
-- TEST 1: Verificar distribución de categorías
-- Resultado esperado: Cada categoría con su propio conjunto de noticias
-- ============================================
SELECT 
  category,
  COUNT(*) as total_articles,
  COUNT(DISTINCT url) as unique_urls,
  MIN("publishedAt") as oldest_article,
  MAX("publishedAt") as newest_article
FROM articles
WHERE category IN ('general', 'deportes', 'tecnologia', 'ciencia', 'internacional')
GROUP BY category
ORDER BY category;

-- ============================================
-- TEST 2: Verificar que NO hay URLs compartidas entre categorías
-- Resultado esperado: 0 filas (cada URL debe tener UNA única categoría)
-- ============================================
SELECT 
  url,
  COUNT(DISTINCT category) as num_categories,
  STRING_AGG(DISTINCT category, ', ') as categories
FROM articles
GROUP BY url
HAVING COUNT(DISTINCT category) > 1
LIMIT 20;

-- ============================================
-- TEST 3: Verificar fuentes de "General"
-- Resultado esperado: Solo dominios de portadas principales
-- ============================================
SELECT 
  CASE 
    WHEN url LIKE '%elpais.com/portada%' THEN 'El País Portada'
    WHEN url LIKE '%elmundo%portada%' THEN 'El Mundo Portada'
    WHEN url LIKE '%20minutos.es%' THEN '20 Minutos'
    WHEN url LIKE '%abc.es/portada%' THEN 'ABC Portada'
    WHEN url LIKE '%lavanguardia.com%' THEN 'La Vanguardia'
    WHEN url LIKE '%eldiario.es%' THEN 'El Diario'
    ELSE 'Otros'
  END as fuente,
  COUNT(*) as total
FROM articles
WHERE category = 'general'
GROUP BY fuente
ORDER BY total DESC;

-- ============================================
-- TEST 4: Verificar fuentes de "Deportes"
-- Resultado esperado: Solo dominios deportivos (Marca, AS, MD, Sport)
-- ============================================
SELECT 
  CASE 
    WHEN url LIKE '%marca.com%' THEN 'Marca'
    WHEN url LIKE '%as.com%' THEN 'AS'
    WHEN url LIKE '%mundodeportivo.com%' THEN 'Mundo Deportivo'
    WHEN url LIKE '%sport.es%' THEN 'Sport'
    WHEN url LIKE '%abc.es%deportes%' THEN 'ABC Deportes'
    ELSE 'Otros'
  END as fuente,
  COUNT(*) as total
FROM articles
WHERE category = 'deportes'
GROUP BY fuente
ORDER BY total DESC;

-- ============================================
-- TEST 5: Verificar que "General" NO tiene noticias de secciones específicas
-- Resultado esperado: 0 filas (general NO debe tener URLs de secciones)
-- ============================================
SELECT 
  url,
  title,
  "publishedAt"
FROM articles
WHERE category = 'general'
  AND (
    url LIKE '%/internacional/%' OR
    url LIKE '%/deportes/%' OR
    url LIKE '%/economia/%' OR
    url LIKE '%/tecnologia/%' OR
    url LIKE '%/ciencia/%'
  )
LIMIT 20;

-- ============================================
-- TEST 6: Conteo total por categoría (últimas 24h)
-- Resultado esperado: Cada categoría con artículos recientes
-- ============================================
SELECT 
  category,
  COUNT(*) as articles_last_24h
FROM articles
WHERE "publishedAt" > NOW() - INTERVAL '24 hours'
GROUP BY category
ORDER BY articles_last_24h DESC;

-- ============================================
-- TEST 7: Verificar duplicados absolutos (mismo URL, diferentes categorías)
-- Resultado esperado: 0 filas (imposible con constraint único en URL)
-- ============================================
SELECT url, COUNT(*) as count
FROM articles
GROUP BY url
HAVING COUNT(*) > 1;

-- ============================================
-- RESUMEN
-- ============================================
-- Si todos los tests pasan:
-- ✅ TEST 1: Cada categoría tiene su propio conjunto de artículos
-- ✅ TEST 2: 0 filas (URLs únicas por categoría)
-- ✅ TEST 3: General solo tiene portadas
-- ✅ TEST 4: Deportes solo tiene medios deportivos
-- ✅ TEST 5: 0 filas (General sin contaminación)
-- ✅ TEST 6: Todas las categorías tienen noticias recientes
-- ✅ TEST 7: 0 filas (sin duplicados de URL)

-- Reset completo de análisis para extracción de imágenes reales
-- Resetea TODAS las noticias con:
-- 1) urlToImage NULL o vacío
-- 2) Imágenes genéricas de Google News (lh3.googleusercontent.com)
-- 3) Placeholders de Unsplash

UPDATE "articles"
SET 
  summary = NULL,
  "biasScore" = NULL,
  analysis = NULL,
  "analyzedAt" = NULL,
  "urlToImage" = NULL
WHERE 
  "urlToImage" IS NULL 
  OR "urlToImage" = ''
  OR "urlToImage" LIKE '%lh3.googleusercontent.com%'
  OR "urlToImage" LIKE '%unsplash.com%';

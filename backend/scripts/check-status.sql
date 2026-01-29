-- Verificar estado actual de análisis e imágenes
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN "analyzedAt" IS NOT NULL THEN 1 ELSE 0 END) as analyzed,
  SUM(CASE WHEN "analyzedAt" IS NULL THEN 1 ELSE 0 END) as pending,
  SUM(CASE WHEN "urlToImage" IS NOT NULL AND "urlToImage" != '' THEN 1 ELSE 0 END) as with_image,
  SUM(CASE WHEN "urlToImage" IS NULL OR "urlToImage" = '' THEN 1 ELSE 0 END) as without_image
FROM "articles";

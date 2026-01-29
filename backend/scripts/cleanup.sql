UPDATE "articles" 
SET summary = NULL, 
    "biasScore" = NULL, 
    analysis = NULL, 
    "analyzedAt" = NULL 
WHERE "urlToImage" IS NULL OR "urlToImage" = '';

SELECT COUNT(*) as "SinImagen" FROM "articles" WHERE "urlToImage" IS NULL OR "urlToImage" = '';
SELECT COUNT(*) as "Pendientes" FROM "articles" WHERE "analyzedAt" IS NULL;
SELECT COUNT(*) as "Analizadas" FROM "articles" WHERE "analyzedAt" IS NOT NULL;

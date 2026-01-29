-- Eliminar todas las noticias actuales (provienen de Google News con URLs obfuscadas)
-- Esto permitirá ingestar noticias frescas con DirectSpanishRssClient

DELETE FROM "articles";

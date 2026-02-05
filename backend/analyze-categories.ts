const RSS_SOURCES = {
  general: 10,
  economia: 10,
  deportes: 8,
  tecnologia: 10,
  ciencia: 8,
  politica: 8,
  internacional: 4,
  cultura: 4,
};

const pageSize = 20; // Default pageSize usado en el código

console.log('=== ANÁLISIS DE CAPACIDAD POR CATEGORÍA ===\n');
console.log(`PageSize configurado: ${pageSize} artículos\n`);

Object.entries(RSS_SOURCES).forEach(([category, numSources]) => {
  const articlesPerSource = Math.max(2, Math.ceil(pageSize / numSources));
  const totalArticles = Math.min(articlesPerSource * numSources, pageSize);

  console.log(`${category.toUpperCase()}`);
  console.log(`  Fuentes RSS: ${numSources}`);
  console.log(`  Artículos por fuente: ${articlesPerSource}`);
  console.log(`  Total aprox: ${totalArticles} artículos`);
  console.log(`  Diversidad: ${totalArticles >= 16 ? '✅ BUENA' : '⚠️ MEJORAR'}\n`);
});

console.log('\n=== RECOMENDACIONES ===');
console.log('- Categorías con pocas fuentes (4) pueden necesitar más artículos por fuente');
console.log('- Considerar aumentar pageSize para categorías dinámicas');

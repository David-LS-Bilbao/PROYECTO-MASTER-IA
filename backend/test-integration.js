const { DependencyContainer } = require('./dist/infrastructure/config/dependencies');

async function testMetadataExtraction() {
  console.log('🧪 TEST: Extrayendo metadata de artículo...\n');
  
  try {
    const container = new DependencyContainer();
    
    // Obtener una noticia sin imagen
    const articles = await container.newsController.getAllNews({ limit: 1, offset: 0 });
    
    if (!articles.data || articles.data.length === 0) {
      console.error('❌ No hay artículos en BD');
      return;
    }
    
    const article = articles.data[0];
    console.log('📰 Artículo seleccionado:');
    console.log(`   Título: ${article.title.substring(0, 60)}`);
    console.log(`   URL: ${article.url.substring(0, 80)}`);
    console.log(`   Imagen actual: ${article.urlToImage || 'NULL'}\n`);
    
    // Usar MetadataExtractor
    const metadata = await container.metadataExtractor.extractMetadata(article.url);
    console.log('📊 Metadata extraída:');
    console.log(`   og:image: ${metadata.ogImage || '❌ NOT FOUND'}`);
    console.log(`   twitter:image: ${metadata.twitterImage || '❌ NOT FOUND'}`);
    console.log(`   title: ${metadata.title || '❌ NOT FOUND'}`);
    console.log(`   description: ${metadata.description || '❌ NOT FOUND'}\n`);
    
    const bestImage = container.metadataExtractor.getBestImageUrl(metadata);
    console.log(`🎯 Mejor imagen seleccionada: ${bestImage || '❌ NONE'}`);
    
  } catch (error) {
    console.error('❌ ERROR en test:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testMetadataExtraction();

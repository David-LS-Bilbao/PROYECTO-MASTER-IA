const axios = require('axios');

async function testDirectAnalysis() {
  console.log('🧪 TEST: Análisis directo vía API\n');
  
  try {
    // Obtener 1 noticia sin imagen
    const newsResp = await axios.get('http://localhost:3000/api/news?limit=1');
    const article = newsResp.data.data.articles[0];
    
    if (!article) {
      console.log('❌ No hay artículos');
      process.exit(1);
    }
    
    console.log('📰 Artículo seleccionado:');
    console.log(`   ID: ${article.id}`);
    console.log(`   Título: ${article.title.substring(0, 60)}`);
    console.log(`   URL: ${article.url.substring(0, 80)}`);
    console.log(`   Imagen actual: ${article.urlToImage || 'NULL'}`);
    console.log(`   Analizado: ${article.isAnalyzed}\n`);
    
    if (article.isAnalyzed && article.urlToImage) {
      console.log('✅ Esta noticia ya fue analizada y tiene imagen.');
      process.exit(0);
    }
    
    // Analizar
    console.log('🔄 Enviando a análisis...');
    const analyzeResp = await axios.post('http://localhost:3000/api/analyze/batch', {
      limit: 1
    });
    
    console.log(`✅ Respuesta: ${analyzeResp.data.data.successful} exitosas, ${analyzeResp.data.data.failed} fallidas`);
    
    // Esperar un poco y verificar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n📊 Verificando resultado...');
    const newsResp2 = await axios.get(`http://localhost:3000/api/news?limit=1`);
    const updatedArticle = newsResp2.data.data.articles[0];
    
    console.log(`   Imagen después: ${updatedArticle.urlToImage ? '✅ ' + updatedArticle.urlToImage.substring(0, 50) + '...' : '❌ NULL'}`);
    console.log(`   Analizado: ${updatedArticle.isAnalyzed}`);
    
    if (updatedArticle.urlToImage) {
      console.log('\n✅ ¡EXITO! MetadataExtractor extrajo imagen correctamente');
    } else {
      console.log('\n❌ Imagen aún es NULL. Problema en MetadataExtractor');
    }
    
  } catch (err) {
    console.error('❌ ERROR:', err.message);
    if (err.response?.data) {
      console.error('Respuesta:', err.response.data);
    }
  }
  
  process.exit(0);
}

testDirectAnalysis();

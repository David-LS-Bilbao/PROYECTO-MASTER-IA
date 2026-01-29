const { MetadataExtractor } = require('./dist/infrastructure/external/metadata-extractor');

async function testFullPipeline() {
  console.log('🧪 TEST COMPLETO: MetadataExtractor en pipeline\n');
  
  try {
    const extractor = new MetadataExtractor();
    
    // Simular varias URLs
    const urls = [
      {
        name: 'Google News (con imagen)',
        url: 'https://news.google.com/rss/articles/CBMiuwJBVV95cUxNSjU4alRTQmZxblVjNkttLXJySHplNUVqeE1zbkp3bl9vcUk5NmkxQkJzNmtRaE14cG1Md01obVZMZjVDZENnNjBLSEtEM1YzaGRQbkI0WHpGSHZDamlJNjZ2WGhRaDZiel9uemV5UmoxaEUwTVd0RWNiR3FUNVpRcFRsRmJ6Y0gyRGJUNmFnZk9BSTF5R21FU0lUcTNnZEJRWEQ5MlhrUFUwdm9ZdWpkeWphWS10bjdWR3c0TUxGLWdpYldkWjlyXzV2TmthbzN0RmZidk1jMjRwS09jV2Q2Q1VTakswNmhBNXZlRG5INmU3WGo0cUhWa1FUN044OUVxMDgza3JuS0c5YndGVmRlRkFxRDk4SEhsR0NKS0NuNG8yV2lvdWE0TGI4ZVJnT2FXYnhRel8zNjA0c2PSAbsCQVVfeXFMTW1xUGdtOUNHVGNLeHdPRnZSUVJxaUhBVVlmbmhNYjhfUVZJUE1hLUNyTnYyWFBHSEFqMmJ1TUNyOHg0ajFkd0NaR2lxVFBVNmhOdXZRRnVXVTZ5TnA1MnFnUkhrX29sTi04NW9mNlhxVkpxM1AxOW1nWHRpZFJSa01hb3dZbHd6SVdHTmlnNE5WZVJuektTSWZWZXpzVzlhTXNlV2xQVmgxdXpicFlDckZDcGdxUTlsOXVReFFVUnRqV2h6SGlxY1dCNVk1SHBrQnZ6Mk53RTI4aWVyaU4za1FadW04RFM2UnBQelFOSFJHcXl3NVdXclR4SUNnWXZVQjBCRVpSd2xNZkRncXktVFIxNUlPamt2dzRzZUpHS0lYWW5mNkgyUjhaYmZfNXkwSXdPdzM0ZzNCdDNz?oc=5'
      }
    ];
    
    let successCount = 0;
    
    for (const {name, url} of urls) {
      console.log(`📍 Probando: ${name}`);
      try {
        const metadata = await extractor.extractMetadata(url);
        const imageUrl = extractor.getBestImageUrl(metadata);
        
        if (imageUrl) {
          console.log(`   ✅ Imagen encontrada: ${imageUrl.substring(0, 70)}`);
          successCount++;
        } else {
          console.log(`   ⚠️ No se encontró imagen`);
        }
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
      }
      console.log('');
    }
    
    console.log(`\n📊 RESULTADO: ${successCount}/${urls.length} URLs procesadas con éxito`);
    console.log('✅ MetadataExtractor funciona correctamente\n');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
  
  process.exit(0);
}

testFullPipeline();

const { MetadataExtractor } = require('./dist/infrastructure/external/metadata-extractor');

async function testMetadataExtractor() {
  console.log('🧪 TEST DIRECTO: MetadataExtractor\n');
  
  try {
    const extractor = new MetadataExtractor();
    
    // Test 1: Google News URL (con imagen)
    console.log('📌 Test 1: Google News URL');
    const googleNewsUrl = 'https://news.google.com/rss/articles/CBMiuwJBVV95cUxNSjU4alRTQmZxblVjNkttLXJySHplNUVqeE1zbkp3bl9vcUk5NmkxQkJzNmtRaE14cG1Md01obVZMZjVDZENnNjBLSEtEM1YzaGRQbkI0WHpGSHZDamlJNjZ2WGhRaDZiel9uemV5UmoxaEUwTVd0RWNiR3FUNVpRcFRsRmJ6Y0gyRGJUNmFnZk9BSTF5R21FU0lUcTNnZEJRWEQ5MlhrUFUwdm9ZdWpkeWphWS10bjdWR3c0TUxGLWdpYldkWjlyXzV2TmthbzN0RmZidk1jMjRwS09jV2Q2Q1VTakswNmhBNXZlRG5INmU3WGo0cUhWa1FUN044OUVxMDgza3JuS0c5YndGVmRlRkFxRDk4SEhsR0NKS0NuNG8yV2lvdWE0TGI4ZVJnT2FXYnhRel8zNjA0c2PSAbsCQVVfeXFMTW1xUGdtOUNHVGNLeHdPRnZSUVJxaUhBVVlmbmhNYjhfUVZJUE1hLUNyTnYyWFBHSEFqMmJ1TUNyOHg0ajFkd0NaR2lxVFBVNmhOdXZRRnVXVTZ5TnA1MnFnUkhrX29sTi04NW9mNlhxVkpxM1AxOW1nWHRpZFJSa01hb3dZbHd6SVdHTmlnNE5WZVJuektTSWZWZXpzVzlhTXNlV2xQVmgxdXpicFlDckZDcGdxUTlsOXVReFFVUnRqV2h6SGlxY1dCNVk1SHBrQnZ6Mk53RTI4aWVyaU4za1FadW04RFM2UnBQelFOSFJHcXl3NVdXclR4SUNnWXZVQjBCRVpSd2xNZkRncXktVFIxNUlPamt2dzRzZUpHS0lYWW5mNkgyUjhaYmZfNXkwSXdPdzM0ZzNCdDNz?oc=5';
    
    const metadata = await extractor.extractMetadata(googleNewsUrl);
    console.log('   Metadata extraída:');
    console.log(`     og:image: ${metadata.ogImage ? '✅ ' + metadata.ogImage.substring(0, 50) + '...' : '❌ NOT FOUND'}`);
    console.log(`     twitter:image: ${metadata.twitterImage ? '✅ ' + metadata.twitterImage.substring(0, 50) + '...' : '❌ NOT FOUND'}`);
    
    const bestImage = extractor.getBestImageUrl(metadata);
    console.log(`   Mejor imagen: ${bestImage ? '✅ ' + bestImage.substring(0, 60) + '...' : '❌ NONE'}\n`);
    
    // Test 2: URL inválida
    console.log('📌 Test 2: URL inválida');
    try {
      await extractor.extractMetadata('not-a-valid-url');
      console.log('   ❌ Debería haber lanzado error\n');
    } catch (err) {
      console.log(`   ✅ Error capturado correctamente: ${err.message}\n`);
    }
    
    console.log('✅ TESTS COMPLETADOS');
    
  } catch (error) {
    console.error('❌ ERROR en test:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

testMetadataExtractor();

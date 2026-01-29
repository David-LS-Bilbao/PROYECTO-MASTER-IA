const axios = require('axios');
const cheerio = require('cheerio');

const testUrl = 'https://news.google.com/rss/articles/CBMiuwJBVV95cUxNSjU4alRTQmZxblVjNkttLXJySHplNUVqeE1zbkp3bl9vcUk5NmkxQkJzNmtRaE14cG1Md01obVZMZjVDZENnNjBLSEtEM1YzaGRQbkI0WHpGSHZDamlJNjZ2WGhRaDZiel9uemV5UmoxaEUwTVd0RWNiR3FUNVpRcFRsRmJ6Y0gyRGJUNmFnZk9BSTF5R21FU0lUcTNnZEJRWEQ5MlhrUFUwdm9ZdWpkeWphWS10bjdWR3c0TUxGLWdpYldkWjlyXzV2TmthbzN0RmZidk1jMjRwS09jV2Q2Q1VTakswNmhBNXZlRG5INmU3WGo0cUhWa1FUN044OUVxMDgza3JuS0c5YndGVmRlRkFxRDk4SEhsR0NKS0NuNG8yV2lvdWE0TGI4ZVJnT2FXYnhRel8zNjA0c2PSAbsCQVVfeXFMTW1xUGdtOUNHVGNLeHdPRnZSUVJxaUhBVVlmbmhNYjhfUVZJUE1hLUNyTnYyWFBHSEFqMmJ1TUNyOHg0ajFkd0NaR2lxVFBVNmhOdXZRRnVXVTZ5TnA1MnFnUkhrX29sTi04NW9mNlhxVkpxM1AxOW1nWHRpZFJSa01hb3dZbHd6SVdHTmlnNE5WZVJuektTSWZWZXpzVzlhTXNlV2xQVmgxdXpicFlDckZDcGdxUTlsOXVReFFVUnRqV2h6SGlxY1dCNVk1SHBrQnZ6Mk53RTI4aWVyaU4za1FadW04RFM2UnBQelFOSFJHcXl3NVdXclR4SUNnWXZVQjBCRVpSd2xNZkRncXktVFIxNUlPamt2dzRzZUpHS0lYWW5mNkgyUjhaYmZfNXkwSXdPdzM0ZzNCdDNz?oc=5';

console.log('🔍 Probando extracción de metadata...\n');

axios.get(testUrl, {
  timeout: 2000,
  maxRedirects: 3,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; VerityNewsBot/1.0)',
  }
})
  .then(res => {
    console.log('✅ Página obtenida. Tamaño:', res.data.length, 'bytes\n');
    
    const $ = cheerio.load(res.data);
    
    // Buscar og:image
    const ogImage = $('meta[property="og:image"]').attr('content');
    console.log('og:image:', ogImage || '❌ NOT FOUND');
    
    // Buscar og:image:secure_url
    const ogImageSecure = $('meta[property="og:image:secure_url"]').attr('content');
    console.log('og:image:secure_url:', ogImageSecure || '❌ NOT FOUND');
    
    // Buscar twitter:image
    const twitterImage = $('meta[name="twitter:image"]').attr('content');
    console.log('twitter:image:', twitterImage || '❌ NOT FOUND');
    
    // Contar total de meta tags
    const totalMeta = $('meta').length;
    console.log('\nTotal meta tags encontrados:', totalMeta);
    
    // Mostrar primeros 10 meta tags
    console.log('\nPrimeros meta tags:');
    $('meta').slice(0, 10).each((i, el) => {
      const name = $(el).attr('name') || $(el).attr('property') || 'unknown';
      const content = $(el).attr('content');
      if (content) {
        console.log(`  ${i+1}. ${name}: ${content.substring(0, 50)}...`);
      }
    });
  })
  .catch(err => {
    console.error('❌ ERROR:', err.message);
  });

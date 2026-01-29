const http = require('http');

const data = JSON.stringify({
  query: 'actualidad',
  pageSize: 20
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/ingest/news',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  },
  timeout: 120000
};

console.log('📥 Ingesta con DirectSpanishRssClient...\n');

const req = http.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(body);
      console.log(`✅ Ingesta exitosa!`);
      console.log(`   Total obtenidas: ${result.data.totalFetched}`);
      console.log(`   Nuevas guardadas: ${result.data.newArticles}`);
      console.log(`   Duplicados: ${result.data.duplicates}`);
      console.log(`   Fuente: ${result.data.source}`);
      process.exit(0);
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.error('Body:', body);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  console.error('❌ Request timeout');
  process.exit(1);
});

req.write(data);
req.end();

const http = require('http');

async function runBatch(limit) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ limit });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/analyze/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      },
      timeout: 180000 // 3 minutes timeout
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n🔄 Ejecutando análisis batch de 85 noticias...\n');
  
  let totalSuccess = 0;
  let totalFailed = 0;

  // 8 batches de 10
  for (let i = 1; i <= 8; i++) {
    try {
      process.stdout.write(`Batch ${i}/9 (10 noticias)... `);
      const result = await runBatch(10);
      const success = result.data.successful;
      const failed = result.data.failed;
      totalSuccess += success;
      totalFailed += failed;
      console.log(`✅ +${success} (${failed} fallidas)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // 1 batch de 5
  try {
    process.stdout.write('Batch 9/9 (5 noticias)... ');
    const result = await runBatch(5);
    const success = result.data.successful;
    const failed = result.data.failed;
    totalSuccess += success;
    totalFailed += failed;
    console.log(`✅ +${success} (${failed} fallidas)`);
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log(`\n📊 RESUMEN FINAL:`);
  console.log(`   Exitosas: ${totalSuccess} ✅`);
  console.log(`   Fallidas: ${totalFailed} ❌\n`);
}

main().catch(console.error);

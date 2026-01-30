import dotenv from 'dotenv';
import { createServer } from './infrastructure/http/server';
import { DependencyContainer } from './infrastructure/config/dependencies';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

const app = createServer();

// Initialize ChromaDB collection on startup
const container = DependencyContainer.getInstance();
container.chromaClient.initCollection()
  .then(() => {
    console.log('✅ ChromaDB collection initialized');
  })
  .catch((err) => {
    console.warn('⚠️ ChromaDB initialization failed (search may not work):', err.message);
  });

app.listen(PORT, () => {
  console.log(`🚀 Verity News API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

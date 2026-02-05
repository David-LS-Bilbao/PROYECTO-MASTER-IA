import dotenv from 'dotenv';
import { createServer } from './infrastructure/http/server';
import { DependencyContainer } from './infrastructure/config/dependencies';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

const app = createServer();

// Initialize services on startup
const container = DependencyContainer.getInstance();

// Initialize ChromaDB collection
container.chromaClient.initCollection()
  .then(() => {
    console.log('✅ ChromaDB collection initialized');
  })
  .catch((err) => {
    console.warn('⚠️ ChromaDB initialization failed (search may not work):', err.message);
  });

// Start Quota Reset Jobs (Sprint 14 - Paso 2: Automatización de Reset de Cuotas)
try {
  container.quotaResetJob.start();
} catch (error) {
  console.error('❌ Failed to start Quota Reset Job:', error);
  // Don't crash the server: quota enforcement can still work manually
}

app.listen(PORT, () => {
  console.log(`🚀 Verity News API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

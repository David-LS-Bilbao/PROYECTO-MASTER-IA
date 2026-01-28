import dotenv from 'dotenv';
import { createServer } from './infrastructure/http/server';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

const app = createServer();

app.listen(PORT, () => {
  console.log(`🚀 Verity News API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

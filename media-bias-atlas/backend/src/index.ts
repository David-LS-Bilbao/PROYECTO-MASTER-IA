import dotenv from 'dotenv';
import path from 'path';

// Load variables properly
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createServer } from './infrastructure/http/server';

const PORT = process.env.PORT || 3001;
const app = createServer();

app.listen(PORT, () => {
  console.log(`🚀 Media Bias Atlas API running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
});

/**
 * Vitest Setup File - Backend
 * 
 * Este archivo se ejecuta ANTES de cargar cualquier test.
 * Configura variables de entorno necesarias para los tests de integración.
 */

// Configurar variables de entorno ANTES de importar cualquier módulo
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-api-key-for-integration-tests';
process.env.JINA_API_KEY = process.env.JINA_API_KEY || 'test-jina-api-key-for-integration-tests';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
process.env.CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
process.env.NODE_ENV = 'test';

// Log para debugging (solo si está habilitado)
if (process.env.DEBUG_TESTS === 'true') {
  console.log('🔧 Backend Test Setup - Variables de entorno configuradas:');
  console.log('  GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Configurada' : '❌ No configurada');
  console.log('  JINA_API_KEY:', process.env.JINA_API_KEY ? '✅ Configurada' : '❌ No configurada');
  console.log('  DATABASE_URL:', process.env.DATABASE_URL);
  console.log('  NODE_ENV:', process.env.NODE_ENV);
}

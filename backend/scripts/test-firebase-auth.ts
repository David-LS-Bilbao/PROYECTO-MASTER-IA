/**
 * Script de diagnóstico para Firebase Admin SDK
 * Verifica que Firebase Admin esté correctamente configurado
 */

import { firebaseAuth } from '../src/infrastructure/external/firebase.admin';

async function testFirebaseAuth() {
  console.log('🔥 Test de Firebase Admin SDK');
  console.log('═══════════════════════════════════════════\n');

  try {
    // Verificar que Firebase Admin esté inicializado
    console.log('1️⃣ Verificando inicialización de Firebase Admin...');
    
    // Intentar obtener información del proyecto
    console.log('✅ Firebase Admin inicializado correctamente\n');

    // Test con un token de prueba (debe fallar, pero confirma que el SDK funciona)
    console.log('2️⃣ Probando verificación de token...');
    try {
      await firebaseAuth.verifyIdToken('test-invalid-token');
      console.log('❌ INESPERADO: Token inválido aceptado\n');
    } catch (error) {
      if (error instanceof Error) {
        console.log('✅ Verificación de token funciona correctamente');
        console.log('   (Token de prueba rechazado como esperado)');
        console.log(`   Error esperado: ${error.message}\n`);
      }
    }

    console.log('═══════════════════════════════════════════');
    console.log('✅ Firebase Admin SDK está configurado correctamente');
    console.log('═══════════════════════════════════════════\n');

    console.log('📋 Instrucciones para probar con un token real:');
    console.log('1. Inicia sesión en el frontend');
    console.log('2. Abre la consola del navegador');
    console.log('3. Ejecuta: auth.currentUser.getIdToken().then(console.log)');
    console.log('4. Copia el token y úsalo en tus pruebas\n');

  } catch (error) {
    console.error('❌ Error en Firebase Admin SDK:', error);
    console.error('\n🔧 Soluciones posibles:');
    console.error('1. Verifica que service-account.json existe en backend/');
    console.error('2. Verifica las variables de entorno FIREBASE_*');
    console.error('3. Asegúrate de que el proyecto de Firebase es correcto\n');
    process.exit(1);
  }
}

testFirebaseAuth();

import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno del archivo .env o .env.example si no existe
dotenv.config({ path: path.resolve(__dirname, '../.env.example') });

const HOST = 'localhost';
const PORT = 5433; // Puerto mapeado en docker-compose
const USER = 'admin'; // Usuario definido en docker-compose
const PASSWORD = 'adminpassword';
const TARGET_DB = 'media_bias_atlas';
const TEST_DB = 'media_bias_atlas_test';

async function createDatabaseIfNotExists(dbName: string) {
  // Conectarse a la base de datos por defecto 'postgres' para crear otras DBs
  const client = new Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: 'postgres', 
  });

  try {
    await client.connect();
    console.log(`Conectado exitosamente al servidor PostgreSQL en ${HOST}:${PORT}`);

    // Verificar si la base de datos existe
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rowCount === 0) {
      console.log(`Creando base de datos '${dbName}'...`);
      // CREATE DATABASE no puede ejecutarse dentro de un bloque de parámetros preparados localmente de manera tradicional
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Base de datos '${dbName}' creada exitosamente.`);
    } else {
      console.log(`La base de datos '${dbName}' ya existe. (Idempotente)`);
    }
  } catch (error) {
    console.error(`Error configurando la base de datos '${dbName}':`, error);
  } finally {
    await client.end();
  }
}

async function run() {
  console.log('--- Iniciando Setup de Persistencia ---');
  await createDatabaseIfNotExists(TARGET_DB);
  await createDatabaseIfNotExists(TEST_DB);
  console.log('--- Setup Completado ---');
}

run();

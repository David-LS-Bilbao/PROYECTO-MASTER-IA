import express from 'express';
import cors from 'cors';
import { setupRoutes } from './routes';

export function createServer(): express.Application {
  const app = express();

  // Middleware básicos
  app.use(express.json());
  app.use(cors());

  // Healthcheck endpoint
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'media-bias-atlas' });
  });

  // Configuración de rutas de dominio
  setupRoutes(app);

  // Error handler básico (Atrapando validaciones de Zod o errores controlados)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation Error', details: err.errors });
      return;
    }
    
    // Errores controlados por dominio/casos de uso (ej. País no existe o Duplicado Prisma)
    let statusCode = 500;
    let publicMessage = err.message;

    if (err.message?.includes('not found') || err.message?.includes('no encontrado')) statusCode = 404;
    // P2002 es Unique Constraint Failed en Prisma
    if (err.code === 'P2002') { 
      statusCode = 409; // Conflicto
      publicMessage = 'El registro ya existe (violación de clave única).';
    }

    const databaseUnavailable = err.code === 'P1001'
      || err.name === 'PrismaClientInitializationError'
      || err.message?.includes("Can't reach database server");

    if (databaseUnavailable) {
      statusCode = 503;
      publicMessage = 'La base de datos de Media Bias Atlas no está disponible. Verifica PostgreSQL en localhost:5433 y vuelve a intentarlo.';
    }

    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal Server Error' : statusCode === 503 ? 'Service Unavailable' : 'Domain Error',
      message: publicMessage,
    });
  });

  return app;
}

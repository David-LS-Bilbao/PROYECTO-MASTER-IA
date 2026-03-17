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
    if (err.message?.includes('not found')) statusCode = 404;
    // P2002 es Unique Constraint Failed en Prisma
    if (err.code === 'P2002') { 
      statusCode = 409; // Conflicto
      err.message = 'El registro ya existe (violación de clave única).';
    }

    res.status(statusCode).json({
      error: statusCode === 500 ? 'Internal Server Error' : 'Domain Error',
      message: err.message,
    });
  });

  return app;
}

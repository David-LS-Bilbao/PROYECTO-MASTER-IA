import { NextFunction, Request, Response, Router } from 'express';
import { AdminAiUsageController } from '../controllers/AdminAiUsageController';

function requireInternalSecret(req: Request, res: Response, next: NextFunction): void {
  const providedSecret = req.header('x-admin-secret') || req.header('x-cron-secret');
  const expectedSecret = process.env.ADMIN_API_SECRET || process.env.CRON_SECRET || '';

  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
    });
    return;
  }

  next();
}

function handleAsync(
  handler: (req: Request, res: Response) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

export function createAdminAiUsageRoutes(controller: AdminAiUsageController): Router {
  const router = Router();

  router.get('/overview', requireInternalSecret, handleAsync(controller.getOverview.bind(controller)));
  router.get('/runs', requireInternalSecret, handleAsync(controller.getRuns.bind(controller)));
  router.get('/prompts', requireInternalSecret, handleAsync(controller.getPrompts.bind(controller)));
  router.get('/compare', requireInternalSecret, handleAsync(controller.getComparison.bind(controller)));

  return router;
}

import { NextFunction, Request, Response, Router } from 'express';
import { AdminAiUsageController } from '../controllers/admin-ai-usage.controller';
import { asyncHandler } from '../middleware/async-handler';

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

export function createAdminAiUsageRoutes(controller: AdminAiUsageController): Router {
  const router = Router();

  router.get(
    '/overview',
    requireInternalSecret,
    asyncHandler(controller.getOverview.bind(controller))
  );

  router.get(
    '/runs',
    requireInternalSecret,
    asyncHandler(controller.getRuns.bind(controller))
  );

  return router;
}

/**
 * Async Handler Wrapper
 * =====================
 *
 * Envuelve controladores async para capturar errores de promesas rechazadas
 * y pasarlos al middleware global de error handling.
 *
 * Problema que resuelve:
 * - Sin este wrapper, los errores en rutas async no se capturan automáticamente
 * - Express no tiene soporte nativo para async/await en routers
 * - Los try-catch en controladores son duplicados e innecesarios
 *
 * Solución:
 * - Este wrapper captura cualquier error en la promesa
 * - Los pasa a next(error) para que el middleware global los maneje
 * - Elimina la necesidad de try-catch en controladores
 *
 * Uso:
 * router.post('/path', asyncHandler(authenticate), asyncHandler(controller.method))
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Type para una función de controlador async
 */
export type AsyncControllerHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Envuelve un controlador async para capturar errores
 * @param fn - Función controlador async
 * @returns Función que captura errores y los pasa a next()
 */
export function asyncHandler(
  fn: AsyncControllerHandler
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Alias para asyncHandler (nomenclatura alternativa)
 */
export const catchAsync = asyncHandler;

/**
 * Versión para middlewares que necesitan acceso a next()
 * Ejemplo: authenticate, validateInput
 *
 * Uso:
 * const myMiddleware = asyncMiddleware(async (req, res, next) => {
 *   const user = await verifyUser(req);
 *   req.user = user;
 *   next();
 * });
 */
export function asyncMiddleware(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

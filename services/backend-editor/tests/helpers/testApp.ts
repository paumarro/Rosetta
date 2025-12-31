import express from 'express';
import { Router } from 'express';
import { catchAsync } from '../../src/utils/asyncErrorHandler.js';
import {
  createDiagramByLP,
  deleteDiagramByLP,
  updateDiagramByLP,
} from '../../src/controllers/diagramController.js';

/**
 * Creates a test-only Express app that bypasses authentication.
 * This is used for testing the saga endpoints directly.
 */
export const createTestApp = () => {
  const app = express();
  app.use(express.json());

  const router = Router();

  // Service-to-service routes (no auth middleware for testing)
  router.post<object, unknown, { learningPathId: string; name?: string }>(
    '/diagrams/by-lp',
    catchAsync(createDiagramByLP),
  );
  router.patch<{ lpId: string }, unknown, { name: string }>(
    '/diagrams/by-lp/:lpId',
    catchAsync(updateDiagramByLP),
  );
  router.delete<{ lpId: string }>(
    '/diagrams/by-lp/:lpId',
    catchAsync(deleteDiagramByLP),
  );

  app.use('/api', router);

  return app;
};

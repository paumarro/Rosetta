import { Router } from 'express';
import { catchAsync } from '../utils/asyncErrorHandler.js';
import {
  getDiagrams,
  getDiagramByName,
  createDiagram,
  updateDiagram,
  deleteDiagramByName,
  createDiagramByLP,
  deleteDiagramByLP,
} from '../controllers/diagramController.js';
import { DiagramBody, DiagramParams } from '../types/diagramTypes.js';
import {
  authenticateRequest,
  requireDiagramAccess,
} from '../middleware/apiAuth.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateRequest);

// Public routes (auth required, no CBAC - returns filtered list)
router.get('/diagrams', catchAsync(getDiagrams));

// Routes with CBAC - require community membership
router.get<DiagramParams>(
  '/diagrams/:name',
  requireDiagramAccess('name'),
  catchAsync(getDiagramByName),
);
router.post<object, unknown, DiagramBody>(
  '/diagrams',
  catchAsync(createDiagram),
); // CBAC checked in controller based on name
router.put<DiagramParams, unknown, DiagramBody>(
  '/diagrams/:name',
  requireDiagramAccess('name'),
  catchAsync(updateDiagram),
);
router.delete<DiagramParams>(
  '/diagrams/:name',
  requireDiagramAccess('name'),
  catchAsync(deleteDiagramByName),
);

// Service-to-service routes (protected by nginx blocking external access)
router.post<object, unknown, { learningPathId: string; name?: string }>(
  '/diagrams/by-lp',
  catchAsync(createDiagramByLP),
);
router.delete<{ lpId: string }>(
  '/diagrams/by-lp/:lpId',
  catchAsync(deleteDiagramByLP),
);

export default router;

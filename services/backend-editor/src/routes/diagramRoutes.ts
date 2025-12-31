import { Router } from 'express';
import { catchAsync } from '../utils/asyncErrorHandler.js';
import {
  getDiagrams,
  getDiagramByName,
  createDiagramByLP,
  deleteDiagramByLP,
  updateDiagramByLP,
} from '../controllers/diagramController.js';
import { DiagramBody, DiagramParams } from '../types/diagramTypes.js';
import {
  authenticateRequest,
  requireDiagramAccess,
} from '../middleware/apiAuth.js';

const router = Router();

// Apply authentication middleware to ALL routes (Zero Trust)
// Service-to-service calls must include valid user token for audit trail
router.use(catchAsync(authenticateRequest));

// Service-to-service routes (Zero Trust: authenticated via user token)
// These enforce SAGA patterns - diagrams can only be created/updated/deleted through backend
// User token provides audit trail of who initiated the operation
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

// Public READ routes (safe, used by frontend-editor for initial load)
router.get('/diagrams', catchAsync(getDiagrams));
router.get<DiagramParams>(
  '/diagrams/:name',
  requireDiagramAccess('name'),
  catchAsync(getDiagramByName),
);

export default router;

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
import { authenticateRequest } from '../middleware/apiAuth.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateRequest);

router.get('/diagrams', catchAsync(getDiagrams));
router.get('/diagrams/:name', catchAsync(getDiagramByName));
router.post('/diagrams', catchAsync(createDiagram));
router.put('/diagrams/:name', catchAsync(updateDiagram));
router.delete('/diagrams/:name', catchAsync(deleteDiagramByName));

router.post('/diagrams/by-lp', catchAsync(createDiagramByLP));
router.delete('/diagrams/by-lp/:lpId', catchAsync(deleteDiagramByLP));
export default router;

import { Router } from 'express';
import { catchAsync } from '../utils/asyncErrorHandler.js';
import {
  getDiagrams,
  getDiagramByName,
  createDiagram,
  updateDiagram,
} from '../controllers/diagramController.js';

const router = Router();

router.get('/diagrams', catchAsync(getDiagrams));
router.get('/diagrams/:name', catchAsync(getDiagramByName));
router.post('/diagrams', catchAsync(createDiagram));
router.put('/diagrams/:name', catchAsync(updateDiagram));

export default router;

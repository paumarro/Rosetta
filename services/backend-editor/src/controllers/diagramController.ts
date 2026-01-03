import { Request, Response } from 'express';
import { DiagramModel } from '../models/diagramModel.js';
import { DiagramBody, DiagramParams } from '../types/diagramTypes.js';
import defaultDiagramTemplate from '../templates/defaultDiagram.json' with { type: 'json' };
import { errors, sendError } from '../utils/errorResponse.js';

/** Retrieves all diagrams with basic metadata (name, createdAt, updatedAt) */
export const getDiagrams = async (_req: Request, res: Response) => {
  const diagrams = await DiagramModel.find().select('name createdAt updatedAt');
  res.json(diagrams);
};

/** Retrieves diagram by learningPathId first, then falls back to name */
export const getDiagramByName = async (
  req: Request<DiagramParams>,
  res: Response,
) => {
  const key = req.params.name;
  let diagram = await DiagramModel.findOne({ learningPathId: key });
  if (!diagram) {
    diagram = await DiagramModel.findOne({ name: key });
  }
  if (!diagram) {
    return errors.notFound(res, 'Diagram');
  }

  // Ensure name is always set (use learningPathId as fallback in MongoDB)
  if (!diagram.name || diagram.name.trim() === '') {
    diagram.name = diagram.learningPathId || key;
  }

  res.json(diagram);
};


/** Creates diagram by learningPathId with idempotent handling of duplicate key errors (saga pattern) */
export const createDiagramByLP = async (
  req: Request<object, object, { learningPathId: string; name?: string }>,
  res: Response,
) => {
  const { learningPathId, name } = req.body;
  const finalName = name && name.trim() !== '' ? name : learningPathId;

  try {
    const nodes = defaultDiagramTemplate.nodes;

    const edges = defaultDiagramTemplate.edges;
    const diagram = new DiagramModel({
      learningPathId,
      name: finalName,
      nodes,
      edges,
    });
    await diagram.save();
    return res.status(201).json(diagram);
  } catch (err) {
    // Handle duplicate key errors (E11000)
    if ((err as Error & { code?: number }).code === 11000) {
      // Check if it's a duplicate learningPathId (idempotency case)
      const existingByLP = await DiagramModel.findOne({ learningPathId });
      if (existingByLP) return res.status(200).json(existingByLP);

      // Check if it's a duplicate name
      const existingByName = await DiagramModel.findOne({ name: finalName });
      if (existingByName) {
        return res.status(409).json({
          error: 'A learning path with this name already exists',
          message: `A diagram with the name "${finalName}" already exists`,
        });
      }
    }
    res.status(500);
    throw new Error(`Error: ${(err as Error).message}`);
  }
};


/** Deletes diagram by learningPathId (saga compensation action for rollback) */
export const deleteDiagramByLP = async (
  req: Request<{ lpId: string }>,
  res: Response,
) => {
  const { lpId } = req.params;
  const result = await DiagramModel.findOneAndDelete({ learningPathId: lpId });
  if (!result) return errors.notFound(res, 'Diagram');
  return res.status(204).send();
};

/** Updates diagram name by learningPathId (called when learning path title changes in main backend) */
export const updateDiagramByLP = async (
  req: Request<{ lpId: string }, object, { name: string }>,
  res: Response,
) => {
  const { lpId } = req.params;
  const { name } = req.body;

  if (!name || String(name).trim() === '') {
    return errors.badRequest(res, 'Name is required');
  }

  const diagram = await DiagramModel.findOneAndUpdate(
    { learningPathId: lpId },
    { $set: { name: name.trim() } },
    { new: true },
  );

  if (!diagram) {
    return errors.notFound(res, 'Diagram');
  }

  return res.json(diagram);
};

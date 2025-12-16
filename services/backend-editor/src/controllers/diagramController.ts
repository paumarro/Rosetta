import { Request, Response } from 'express';
import { DiagramModel } from '../models/diagramModel.js';
import { DiagramBody, DiagramParams } from '../types/diagramTypes.js';
import defaultDiagramTemplate from '../templates/defaultDiagram.json' with { type: 'json' };
import { errors } from '../utils/errorResponse.js';

export const getDiagrams = async (_req: Request, res: Response) => {
  const diagrams = await DiagramModel.find().select('name createdAt updatedAt');
  res.json(diagrams);
};

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
  res.json(diagram);
};

export const createDiagram = async (
  req: Request<object, object, DiagramBody>,
  res: Response,
) => {
  try {
    const { name, nodes, edges, learningPathId } = req.body;
    if (!name || String(name).trim() === '') {
      return errors.badRequest(res, 'Name is required');
    }
    const diagram = new DiagramModel({
      name,
      nodes,
      edges,
      learningPathId,
    });
    await diagram.save();
    res.status(201).json(diagram);
  } catch (err) {
    const code = (err as Error & { code?: number }).code;
    if (code === 11000) {
      const existing = await DiagramModel.findOne({ name: req.body.name });
      if (existing)
        return res
          .status(409)
          .json({ error: 'Diagram already exists', diagram: existing });
    }
    res.status(500);
    throw new Error(`Error: ${(err as Error).message}`);
  }
};

export const updateDiagram = async (
  req: Request<DiagramParams, object, DiagramBody>,
  res: Response,
) => {
  const { nodes, edges } = req.body;
  const key = req.params.name;
  let diagram = await DiagramModel.findOneAndUpdate(
    { learningPathId: key },
    { $set: { nodes, edges } },
    { new: true },
  );
  if (!diagram) {
    diagram = await DiagramModel.findOneAndUpdate(
      { name: key },
      { $set: { nodes, edges } },
      { new: true },
    );
  }
  if (!diagram) {
    return errors.notFound(res, 'Diagram');
  }
  res.json(diagram);
};

// New: create diagram by LP UUID with idempotency on E11000
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

// Delete diagram by name
export const deleteDiagramByName = async (
  req: Request<DiagramParams>,
  res: Response,
) => {
  const { name } = req.params;

  // First, check if the diagram exists and has an associated learning path
  let diagram = await DiagramModel.findOne({ learningPathId: name });
  if (!diagram) {
    diagram = await DiagramModel.findOne({ name });
  }
  if (!diagram) {
    return errors.notFound(res, 'Diagram');
  }

  // Prevent deletion if it has an associated learning path
  if (diagram.learningPathId && diagram.learningPathId !== diagram.name) {
    return res.status(409).json({
      error: 'Cannot delete diagram with associated learning path',
      message:
        'Please delete the learning path first, which will cascade delete the diagram',
      learningPathId: diagram.learningPathId,
    });
  }

  // If no learning path is associated, allow deletion
  await DiagramModel.findOneAndDelete(
    diagram.learningPathId ? { learningPathId: name } : { name },
  );
  return res.status(204).send();
};

// New: delete diagram by LP UUID (compensation)
export const deleteDiagramByLP = async (
  req: Request<{ lpId: string }>,
  res: Response,
) => {
  const { lpId } = req.params;
  const result = await DiagramModel.findOneAndDelete({ learningPathId: lpId });
  if (!result) return errors.notFound(res, 'Diagram');
  return res.status(204).send();
};

import { Request, Response } from 'express';
import { DiagramModel } from '../models/diagramModel.js';
import { DiagramBody, DiagramParams } from '../types/diagramTypes.js';

export const getDiagrams = async (_req: Request, res: Response) => {
  const diagrams = await DiagramModel.find().select('name createdAt updatedAt');
  res.json(diagrams);
};

export const getDiagramByName = async (
  req: Request<DiagramParams>,
  res: Response,
) => {
  const diagram = await DiagramModel.findOne({ name: req.params.name });
  if (!diagram) {
    return res.status(404).json({ error: 'Diagram not found' });
  }
  res.json(diagram);
};

export const createDiagram = async (
  req: Request<object, object, DiagramBody>,
  res: Response,
) => {
  try {
    const { name, nodes, edges, learningPathId } = req.body;
    const diagram = new DiagramModel({ name, nodes, edges, learningPathId });
    await diagram.save();
    res.status(201).json(diagram);
  } catch (err) {
    if (err instanceof Error) {
      res.status(500);
      throw new Error(`Error: ${err.message}`);
    }
  }
};

export const updateDiagram = async (
  req: Request<DiagramParams, object, DiagramBody>,
  res: Response,
) => {
  const { nodes, edges } = req.body;
  const diagram = await DiagramModel.findOneAndUpdate(
    { name: req.params.name },
    { $set: { nodes, edges } },
    { new: true },
  );
  if (!diagram) {
    return res.status(404).json({ error: 'Diagram not found' });
  }
  res.json(diagram);
};

// New: create diagram by LP UUID with idempotency on E11000
export const createDiagramByLP = async (
  req: Request<object, object, { learningPathId: string; name?: string }>,
  res: Response,
) => {
  console.log('createDiagramByLP request body:', JSON.stringify(req.body));
  const { learningPathId, name } = req.body;
  const finalName = name && name.trim() !== '' ? name : learningPathId;
  console.log(
    'learningPathId:',
    learningPathId,
    'name:',
    name,
    'finalName:',
    finalName,
  );
  try {
    const diagram = new DiagramModel({
      learningPathId,
      name: finalName,
      nodes: [],
      edges: [],
    });
    await diagram.save();
    return res.status(201).json(diagram);
  } catch (err) {
    // If duplicate key on learningPathId, return the existing document
    if ((err as Error & { code?: number }).code === 11000) {
      const existing = await DiagramModel.findOne({ learningPathId });
      if (existing) return res.status(200).json(existing);
    }
    res.status(500);
    throw new Error(`Error: ${(err as Error).message}`);
  }
};

// New: delete diagram by LP UUID (compensation)
export const deleteDiagramByLP = async (
  req: Request<{ lpId: string }>,
  res: Response,
) => {
  const { lpId } = req.params;
  const result = await DiagramModel.findOneAndDelete({ learningPathId: lpId });
  if (!result) return res.status(404).json({ error: 'Diagram not found' });
  return res.status(204).send();
};

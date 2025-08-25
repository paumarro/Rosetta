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
    const { name, nodes, edges } = req.body;
    const diagram = new DiagramModel({ name, nodes, edges });
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

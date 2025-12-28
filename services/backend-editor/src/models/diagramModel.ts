import mongoose from 'mongoose';

// Define interfaces for our diagram data
interface INode {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    [key: string]: unknown;
  };
}

interface IEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface IDiagram {
  learningPathId: string;
  name: string;
  nodes: INode[];
  edges: IEdge[];
  createdAt: Date;
  updatedAt: Date;
}

// Create the schema
const nodeSchema = new mongoose.Schema(
  {
    id: String,
    type: String,
    position: {
      x: Number,
      y: Number,
    },
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    measured: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  { _id: false },
);

const edgeSchema = new mongoose.Schema(
  {
    id: String,
    source: String,
    target: String,
    sourceHandle: String,
    targetHandle: String,
  },
  { _id: false },
);

const diagramSchema = new mongoose.Schema<IDiagram>(
  {
    learningPathId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      unique: true,
    },
    nodes: [nodeSchema],
    edges: [edgeSchema],
  },
  {
    timestamps: true,
  },
);

// Create and export the model (check if already exists for test compatibility)
export const DiagramModel =
  mongoose.models.Diagram ||
  mongoose.model<IDiagram>('Diagram', diagramSchema);

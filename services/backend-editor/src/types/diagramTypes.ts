// Define types for request parameters and body
export interface DiagramParams {
  name: string;
}

export interface DiagramNode {
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
  measured?: {
    width: number;
    height: number;
  };
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface DiagramBody {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  learningPathId?: string;
}

export interface DiagramResponse {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  createdAt: Date;
  updatedAt: Date;
}

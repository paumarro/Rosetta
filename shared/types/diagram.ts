/**
 * Unified Diagram types - standardized with camelCase fields
 */
export interface DiagramNode {
  id: string;
  type: string;
  isBeingEdited: boolean;
  editedBy?: string | null;
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

export interface Diagram {
  name: string;
  learningPathId?: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  createdAt?: Date;
  updatedAt?: Date;
}

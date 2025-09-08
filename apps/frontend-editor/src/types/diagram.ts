import type { BaseEntity, BaseStore } from './base.ts';
import type { DiagramNode, DiagramEdge } from './reactflow.ts';
// Core diagram type
export interface Diagram extends BaseEntity {
  name: string;
}

// export type DiagramStatus = 'draft' | 'published' | 'archived';

// export type DiagramWithStatus = Diagram & { status: DiagramStatus };

// Full diagram with nodes/edges (for editor)
export interface FullDiagram extends Diagram {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

// API request types (using Pick/Omit only where it adds clear value)
export type CreateDiagramRequest = Pick<
  FullDiagram,
  'name' | 'nodes' | 'edges'
>;

//Store interface
export interface DiagramStore extends BaseStore {
  diagrams: Diagram[];
  // Actions
  fetchDiagrams: () => Promise<void>;
  addDiagram: (name: string) => Promise<void>;
}

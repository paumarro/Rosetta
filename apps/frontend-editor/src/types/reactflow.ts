import type { Node, Edge } from '@xyflow/react';

type Resource = {
  title: string;
  type: 'article' | 'video';
  url: string;
};

type TopicNodeData = {
  label: string;
  side: 0 | 1 | 2 | 3; // 0 for center, 1 for right, 2 for left, 3 for no specific side
  parentId?: string | null;
  description?: string;
  resources?: Resource[];
  [key: string]: unknown; // Add index signature
};

export interface DiagramNode extends Node {
  data: TopicNodeData;
  type: string; // ReactFlow type: "topic" or "subtopic"
  isBeingEdited?: boolean;
  editedBy?: string | null;
}

export type DiagramEdge = Edge;

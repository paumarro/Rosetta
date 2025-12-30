import type { DiagramNode } from '@/types/reactflow';

/**
 * Constants for node positioning calculations
 */
export const NODE_SPACING = {
  TOPIC_Y: 200,
  TOPIC_X: 200,
  SUBTOPIC_Y: 50,
  SUBTOPIC_X: 200,
} as const;

/**
 * Calculate node side based on x position
 * 1 = right side, 2 = left side
 */
export const calculateNodeSide = (x: number): 1 | 2 => {
  return x >= 0 ? 1 : 2;
};

/**
 * Get the last node of a specific type
 */
const getLastNodeType = (
  nodes: DiagramNode[],
  type: string,
): DiagramNode | undefined => {
  const nodesOfType = nodes.filter((node) => node.type === type);
  return nodesOfType.length > 0
    ? nodesOfType[nodesOfType.length - 1]
    : undefined;
};

/**
 * Calculate position for a new topic node
 */
const calculateTopicPosition = (
  nodes: DiagramNode[],
): { x: number; y: number } => {
  const topicNodes = nodes.filter((node) => node.type === 'topic');
  const nodeCount = topicNodes.length;
  const lastNode = getLastNodeType(nodes, 'topic');
  const lastPosition = lastNode?.position ?? { x: 0, y: 0 };

  const isEven = nodeCount % 2 === 0;
  const xPosition =
    nodeCount === 0 ? 0 : isEven ? -NODE_SPACING.TOPIC_X : NODE_SPACING.TOPIC_X;

  return {
    x: xPosition,
    y: lastPosition.y + NODE_SPACING.TOPIC_Y,
  };
};

/**
 * Calculate position for a new subtopic node
 */
const calculateSubtopicPosition = (
  nodes: DiagramNode[],
): { x: number; y: number } => {
  const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : undefined;
  const lastPosition = lastNode?.position ?? { x: 0, y: 0 };

  const topicNodes = nodes.filter((node) => node.type === 'topic');
  const isEvenTopic = topicNodes.length % 2 === 0;
  const xOffset = isEvenTopic
    ? NODE_SPACING.SUBTOPIC_X
    : -NODE_SPACING.SUBTOPIC_X;

  if (lastNode?.type === 'topic') {
    return {
      x: lastPosition.x + xOffset,
      y: lastPosition.y - NODE_SPACING.SUBTOPIC_Y,
    };
  }

  return {
    x: lastPosition.x,
    y: lastPosition.y + NODE_SPACING.SUBTOPIC_Y,
  };
};

/**
 * Calculate automatic position for a new node based on type
 */
export const calculateAutoPosition = (
  type: string,
  nodes: DiagramNode[],
): { x: number; y: number } => {
  switch (type) {
    case 'topic':
      return calculateTopicPosition(nodes);
    case 'subtopic':
      return calculateSubtopicPosition(nodes);
    default:
      return { x: 0, y: 0 };
  }
};

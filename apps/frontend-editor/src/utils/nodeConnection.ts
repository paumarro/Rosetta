import { createContext, useContext, useMemo } from 'react';
import { Node, Position, Edge } from '@xyflow/react';

export interface ConnectionState {
  sourceNode: Node | null;
  sourceHandleId: string | null;
}

export const ConnectionContext = createContext<ConnectionState>({
  sourceNode: null,
  sourceHandleId: null,
});

/**
 * Centralized constants for node dimensions and sizing
 */
export const NODE_DIMENSIONS = {
  LABEL_THRESHOLD: 16,
  LABEL_MAX_LENGTH: 30,
  TWO_LINE_HEIGHT: 75,
  BASE_HEIGHT: {
    TOPIC: 52,
    SUBTOPIC: 38,
  },
  WIDTH_BREAKPOINTS: {
    SMALL: 5,
    MEDIUM: 8,
  },
  WIDTH_VALUES: {
    SMALL: 72,
    MEDIUM: 102,
    LARGE: 170,
  },
  HEIGHT_CLASSES: {
    TOPIC_SHORT: 'h-[52px]',
    TOPIC_TALL: 'h-[75px]',
    SUBTOPIC_SHORT: 'h-[38px]',
    SUBTOPIC_TALL: 'h-[75px]',
  },
} as const;

/**
 * Centralized constants for ReactFlow editor configuration
 */
export const EDITOR_CONFIG = {
  CURSOR_THROTTLE_MS: 50,
  SNAP_GRID: [15, 15] as [number, number],
  MIN_ZOOM: 0.8,
  MAX_ZOOM: 1.8,
  CONNECTION_RADIUS: 50,
  FIT_VIEW: {
    PADDING: 0.2,
    DURATION: 800,
  },
  TITLE_CHAR_WIDTH: 18.6,
  TITLE_OFFSET_Y: 100,
} as const;

/**
 * Gets the Tailwind height class for a node based on label length and type.
 * Returns h-[75px] for labels > 16 chars, otherwise type-specific height.
 */
export function getNodeHeightClass(
  label: string,
  nodeType: string | undefined,
): string {
  const labelLength = label.length;
  const isLong = labelLength > NODE_DIMENSIONS.LABEL_THRESHOLD;

  if (nodeType === 'subtopic') {
    return isLong
      ? NODE_DIMENSIONS.HEIGHT_CLASSES.SUBTOPIC_TALL
      : NODE_DIMENSIONS.HEIGHT_CLASSES.SUBTOPIC_SHORT;
  } else {
    return isLong
      ? NODE_DIMENSIONS.HEIGHT_CLASSES.TOPIC_TALL
      : NODE_DIMENSIONS.HEIGHT_CLASSES.TOPIC_SHORT;
  }
}

/**
 * Maps handle ID to its position on the node
 */
const handleIdToPosition: Record<string, Position> = {
  t: Position.Top,
  r: Position.Right,
  b: Position.Bottom,
  l: Position.Left,
};

/**
 * Handler normal vectors - direction each handler "faces"
 * In canvas coordinates: X+ is right, Y+ is down
 */
const handleNormals: Record<Position, { x: number; y: number }> = {
  [Position.Top]: { x: 0, y: -1 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Bottom]: { x: 0, y: 1 },
  [Position.Left]: { x: -1, y: 0 },
};

/**
 * Calculates the dot product of two 2D vectors
 */
function dotProduct(
  v1: { x: number; y: number },
  v2: { x: number; y: number },
): number {
  return v1.x * v2.x + v1.y * v2.y;
}

/**
 * Gets node dimensions based on type and label length.
 * Uses centralized NODE_DIMENSIONS constants.
 * Can accept either a Node object or raw label/type values.
 */
export function getNodeDimensions(
  nodeOrLabel: Node | string,
  nodeType?: string,
): { width: number; height: number } {
  const label =
    typeof nodeOrLabel === 'string'
      ? nodeOrLabel
      : (nodeOrLabel.data.label as string) || '';
  const type =
    typeof nodeOrLabel === 'string'
      ? nodeType || 'topic'
      : nodeOrLabel.type || 'topic';

  const labelLength = label.length;

  // Use 75px height for labels > 16 chars, otherwise type-specific base height
  const baseHeight =
    type === 'subtopic'
      ? NODE_DIMENSIONS.BASE_HEIGHT.SUBTOPIC
      : NODE_DIMENSIONS.BASE_HEIGHT.TOPIC;
  const height =
    labelLength > NODE_DIMENSIONS.LABEL_THRESHOLD
      ? NODE_DIMENSIONS.TWO_LINE_HEIGHT
      : baseHeight;

  let width: number;
  if (labelLength <= NODE_DIMENSIONS.WIDTH_BREAKPOINTS.SMALL) {
    width = NODE_DIMENSIONS.WIDTH_VALUES.SMALL;
  } else if (labelLength <= NODE_DIMENSIONS.WIDTH_BREAKPOINTS.MEDIUM) {
    width = NODE_DIMENSIONS.WIDTH_VALUES.MEDIUM;
  } else {
    width = NODE_DIMENSIONS.WIDTH_VALUES.LARGE;
  }

  return { width, height };
}

/**
 * Gets the center point of a node.
 * Can accept a Node object or position + label + type.
 */
export function getNodeCenter(
  nodeOrPosition: Node | { x: number; y: number },
  label?: string,
  nodeType?: string,
): { x: number; y: number } {
  if ('id' in nodeOrPosition) {
    // It's a Node object
    const { width, height } = getNodeDimensions(nodeOrPosition);
    return {
      x: nodeOrPosition.position.x + width / 2,
      y: nodeOrPosition.position.y + height / 2,
    };
  }
  // It's a position with label and type
  const { width, height } = getNodeDimensions(label || '', nodeType);
  return {
    x: nodeOrPosition.x + width / 2,
    y: nodeOrPosition.y + height / 2,
  };
}

/**
 * Determines if a connection between two handlers is valid using vector mathematics.
 *
 * Uses dot product to verify that both handlers "face toward" each other,
 * preventing nonsensical connections (e.g., connecting left handle to node on the right).
 */
export function isValidTargetHandle(
  sourceNode: Node,
  targetNode: Node,
  sourceHandleId: string | null,
  targetHandleId: string | null,
): boolean {
  if (!sourceHandleId || !targetHandleId) return true;

  const sourcePos = getNodeCenter(sourceNode);
  const targetPos = getNodeCenter(targetNode);

  // Direction vector from target to source
  const directionToSource = {
    x: sourcePos.x - targetPos.x,
    y: sourcePos.y - targetPos.y,
  };

  // Get handler normal vectors (direction each handler "faces")
  const sourceHandlePosition = handleIdToPosition[sourceHandleId];
  const targetHandlePosition = handleIdToPosition[targetHandleId];
  const sourceNormal = handleNormals[sourceHandlePosition];
  const targetNormal = handleNormals[targetHandlePosition];

  // Check if both handlers face toward each other using dot product
  // Positive dot product means vectors point in similar direction
  const sourceFacesTarget = dotProduct(sourceNormal, {
    x: -directionToSource.x,
    y: -directionToSource.y,
  });
  const targetFacesSource = dotProduct(targetNormal, directionToSource);

  // Both must be positive (handlers face each other)
  return sourceFacesTarget > 0 && targetFacesSource > 0;
}

/**
 * Checks if two nodes are connected by any edge (bidirectional).
 * Returns true if there's any connection between nodeA and nodeB in either direction.
 */
export function areNodesConnected(
  edges: Edge[],
  nodeAId: string,
  nodeBId: string,
): boolean {
  return edges.some(
    (edge) =>
      (edge.source === nodeAId && edge.target === nodeBId) ||
      (edge.source === nodeBId && edge.target === nodeAId),
  );
}

/**
 * Hook to determine which handles should be visible on a node during connection drag.
 * Consolidates handle visibility logic based on connection state.
 */
export function useHandleVisibility(
  nodeId: string,
  nodeType: string | undefined,
  nodePosition: { x: number; y: number },
  nodeData: { label: string; [key: string]: unknown },
  edges: Edge[],
): { t: boolean; r: boolean; b: boolean; l: boolean } {
  const connectionState = useContext(ConnectionContext);

  return useMemo(() => {
    // If no connection is being made, all handles are visible
    if (!connectionState.sourceNode || !connectionState.sourceHandleId) {
      return { t: true, r: true, b: true, l: true };
    }

    // If this is the source node, only show the source handle
    if (connectionState.sourceNode.id === nodeId) {
      return {
        t: connectionState.sourceHandleId === 't',
        r: connectionState.sourceHandleId === 'r',
        b: connectionState.sourceHandleId === 'b',
        l: connectionState.sourceHandleId === 'l',
      };
    }

    // Check if nodes are already connected (prevents duplicate connections)
    if (areNodesConnected(edges, connectionState.sourceNode.id, nodeId)) {
      return { t: false, r: false, b: false, l: false };
    }

    // For other nodes, check which handles are valid targets
    const currentNode = {
      id: nodeId,
      type: nodeType || 'topic',
      position: nodePosition,
      data: nodeData,
    } as Node;

    return {
      t: isValidTargetHandle(
        connectionState.sourceNode,
        currentNode,
        connectionState.sourceHandleId,
        't',
      ),
      r: isValidTargetHandle(
        connectionState.sourceNode,
        currentNode,
        connectionState.sourceHandleId,
        'r',
      ),
      b: isValidTargetHandle(
        connectionState.sourceNode,
        currentNode,
        connectionState.sourceHandleId,
        'b',
      ),
      l: isValidTargetHandle(
        connectionState.sourceNode,
        currentNode,
        connectionState.sourceHandleId,
        'l',
      ),
    };
  }, [connectionState, nodeId, nodeType, nodePosition, nodeData, edges]);
}

/**
 * Gets the width class for a node based on its label length.
 * Consolidated from duplicate implementations.
 */
export function getNodeWidthClass(label: string): string {
  const textLength = label.length;
  if (textLength <= 5) {
    return 'w-[72px]';
  } else if (textLength <= 8) {
    return 'w-[102px]';
  } else {
    return 'w-[170px]';
  }
}

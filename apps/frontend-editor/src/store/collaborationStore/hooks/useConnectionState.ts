import { useState, useCallback } from 'react';
import { OnConnectStart, OnConnectEnd, Node } from '@xyflow/react';
import { ConnectionState } from '@/utils/nodeConnection';
import { DiagramNode } from '@/types/reactflow';

/**
 * Hook to manage connection drag state for ReactFlow.
 * Tracks the source node and handle when a user starts dragging a connection.
 * Used to determine which target handles should be visible during connection.
 */
export function useConnectionState(nodes: DiagramNode[]) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    sourceNode: null,
    sourceHandleId: null,
  });

  const handleConnectStart = useCallback<OnConnectStart>(
    (_, { nodeId, handleId }) => {
      if (!nodeId || !handleId) return;
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (sourceNode) {
        setConnectionState({
          sourceNode: sourceNode as Node,
          sourceHandleId: handleId,
        });
      }
    },
    [nodes],
  );

  const handleConnectEnd = useCallback<OnConnectEnd>(() => {
    setConnectionState({
      sourceNode: null,
      sourceHandleId: null,
    });
  }, []);

  return {
    connectionState,
    handleConnectStart,
    handleConnectEnd,
  };
}

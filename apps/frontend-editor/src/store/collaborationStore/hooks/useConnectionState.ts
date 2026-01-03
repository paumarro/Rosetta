import { useState, useCallback } from 'react';
import { OnConnectStart, OnConnectEnd, Node } from '@xyflow/react';
import { ConnectionState } from '@/utils/nodeConnection';
import { DiagramNode } from '@/types/reactflow';

/** Manages ReactFlow connection drag state to track source node and determine visible target handles */
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

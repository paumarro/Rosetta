import { useCollaborativeStore } from '../index';
import { useMemo } from 'react';

/** Returns node data with editing status and editor username for the specified node ID */
export const useNodeState = (id: string) => {
  const { nodes } = useCollaborativeStore();

  return useMemo(() => {
    const currentNode = nodes.find((n) => n.id === id);
    return {
      node: currentNode,
      isBeingEdited: currentNode?.isBeingEdited || false,
      editedBy: currentNode?.editedBy || null,
    };
  }, [nodes, id]);
};

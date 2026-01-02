import { useCollaborativeStore } from '../index';
import { useMemo } from 'react';

/**
 * Hook to get the state of a specific node by ID.
 * Returns the node data along with editing status.
 * @param id - The unique identifier of the node
 * @returns Object containing node data, editing status, and editor username
 */
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

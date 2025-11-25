import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { useMemo } from 'react';

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

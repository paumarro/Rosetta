import { useCollaborativeStore } from '../index';
import { useShallow } from 'zustand/react/shallow';

/** Returns node data with editing status and editor username for the specified node ID */
export const useNodeState = (id: string) => {
  return useCollaborativeStore(
    useShallow((state) => {
      const currentNode = state.nodes.find((n) => n.id === id);
      return {
        node: currentNode,
        isBeingEdited: currentNode?.isBeingEdited || false,
        editedBy: currentNode?.editedBy || null,
      };
    }),
  );
};

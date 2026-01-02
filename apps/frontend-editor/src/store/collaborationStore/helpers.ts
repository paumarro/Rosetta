import type { CollaborativeUser } from '@/types/collaboration';
import { calculateNodeSide } from '@/utils/nodePosition';
import * as Y from 'yjs';

/**
 * Creates a new Yjs node in the collaborative document.
 * Initializes the node with type, position, label, and editing state.
 * @param ydoc - The Yjs document instance
 * @param id - Unique identifier for the new node
 * @param type - Node type ('topic' or 'subtopic')
 * @param position - Initial position coordinates
 * @param currentUser - Current user for attribution (nullable)
 */
export const createYjsNode = (
  ydoc: Y.Doc,
  id: string,
  type: string,
  position: { x: number; y: number },
  currentUser: CollaborativeUser | null,
): void => {
  const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yNode = new Y.Map<unknown>();

  yNode.set('type', type);
  yNode.set('position', position);
  yNode.set('data', {
    label: type.charAt(0).toUpperCase() + type.slice(1),
    side: calculateNodeSide(position.x),
  });
  yNode.set('isBeingEdited', false);
  yNode.set('editedBy', currentUser?.userName || null);

  yNodes.set(id, yNode);
};

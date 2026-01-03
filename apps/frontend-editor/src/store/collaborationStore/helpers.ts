import type { CollaborativeUser } from '@/types/collaboration';
import { calculateNodeSide } from '@/utils/nodePosition';
import * as Y from 'yjs';

/** Creates new Yjs node in collaborative document with type, position, label, and editing state */
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

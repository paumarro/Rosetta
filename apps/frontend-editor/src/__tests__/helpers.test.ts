import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { createYjsNode } from '@/store/collaborationStore/helpers';

describe('createYjsNode', () => {
  it('creates a node with correct structure in Yjs document', () => {
    const ydoc = new Y.Doc();
    const position = { x: 100, y: 200 };
    const user = { userId: 'u1', userName: 'Alice' };

    createYjsNode(ydoc, 'node-1', 'topic', position, user);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get('node-1');

    expect(yNode).toBeDefined();
    expect(yNode?.get('type')).toBe('topic');
    expect(yNode?.get('position')).toEqual({ x: 100, y: 200 });
  });

  it('sets default label based on node type with capitalized first letter', () => {
    const ydoc = new Y.Doc();

    createYjsNode(ydoc, 'node-1', 'topic', { x: 0, y: 0 }, null);
    createYjsNode(ydoc, 'node-2', 'subtopic', { x: 0, y: 0 }, null);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');

    const topicData = yNodes.get('node-1')?.get('data') as Record<
      string,
      unknown
    >;
    const subtopicData = yNodes.get('node-2')?.get('data') as Record<
      string,
      unknown
    >;

    expect(topicData.label).toBe('Topic');
    expect(subtopicData.label).toBe('Subtopic');
  });

  it('calculates side based on x position', () => {
    const ydoc = new Y.Doc();

    // x >= 0 should be side 1 (right)
    createYjsNode(ydoc, 'right-node', 'topic', { x: 100, y: 0 }, null);
    // x < 0 should be side 2 (left)
    createYjsNode(ydoc, 'left-node', 'topic', { x: -100, y: 0 }, null);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');

    const rightData = yNodes.get('right-node')?.get('data') as Record<
      string,
      unknown
    >;
    const leftData = yNodes.get('left-node')?.get('data') as Record<
      string,
      unknown
    >;

    expect(rightData.side).toBe(1);
    expect(leftData.side).toBe(2);
  });

  it('initializes edit state as not being edited', () => {
    const ydoc = new Y.Doc();
    const user = { userId: 'u1', userName: 'Alice' };

    createYjsNode(ydoc, 'node-1', 'topic', { x: 0, y: 0 }, user);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get('node-1');

    expect(yNode?.get('isBeingEdited')).toBe(false);
  });

  it('records creating user name in editedBy field', () => {
    const ydoc = new Y.Doc();
    const user = { userId: 'u1', userName: 'Alice' };

    createYjsNode(ydoc, 'node-1', 'topic', { x: 0, y: 0 }, user);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get('node-1');

    expect(yNode?.get('editedBy')).toBe('Alice');
  });

  it('handles null user gracefully', () => {
    const ydoc = new Y.Doc();

    createYjsNode(ydoc, 'node-1', 'topic', { x: 0, y: 0 }, null);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yNode = yNodes.get('node-1');

    expect(yNode?.get('editedBy')).toBeNull();
  });

  it('overwrites existing node with same ID', () => {
    const ydoc = new Y.Doc();

    createYjsNode(ydoc, 'node-1', 'topic', { x: 0, y: 0 }, null);
    createYjsNode(ydoc, 'node-1', 'subtopic', { x: 100, y: 100 }, null);

    const yNodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    expect(yNodes.size).toBe(1);

    const yNode = yNodes.get('node-1');
    expect(yNode?.get('type')).toBe('subtopic');
    expect(yNode?.get('position')).toEqual({ x: 100, y: 100 });
  });
});

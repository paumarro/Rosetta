import { describe, it, expect } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import {
  isValidTargetHandle,
  areNodesConnected,
  getNodeDimensions,
  getNodeCenter,
  NODE_DIMENSIONS,
} from '@/utils/nodeConnection';

describe('Connection Validation', () => {
  describe('isValidTargetHandle', () => {
    const createNode = (
      id: string,
      x: number,
      y: number,
      label = 'Test',
    ): Node => ({
      id,
      type: 'topic',
      position: { x, y },
      data: { label },
    });

    it('allows connection when handles face each other horizontally', () => {
      // Node A on left, Node B on right
      const nodeA = createNode('a', 0, 100);
      const nodeB = createNode('b', 300, 100);

      // A's right handle → B's left handle (valid)
      expect(isValidTargetHandle(nodeA, nodeB, 'r', 'l')).toBe(true);
    });

    it('allows connection when handles face each other vertically', () => {
      // Node A above, Node B below
      const nodeA = createNode('a', 100, 0);
      const nodeB = createNode('b', 100, 200);

      // A's bottom handle → B's top handle (valid)
      expect(isValidTargetHandle(nodeA, nodeB, 'b', 't')).toBe(true);
    });

    it('rejects connection when source handle faces away from target', () => {
      // Node A on left, Node B on right
      const nodeA = createNode('a', 0, 100);
      const nodeB = createNode('b', 300, 100);

      // A's left handle (faces left) → B's left handle (both face same direction)
      expect(isValidTargetHandle(nodeA, nodeB, 'l', 'l')).toBe(false);
    });

    it('rejects connection when target handle faces away from source', () => {
      // Node A on left, Node B on right
      const nodeA = createNode('a', 0, 100);
      const nodeB = createNode('b', 300, 100);

      // A's right handle → B's right handle (B faces away)
      expect(isValidTargetHandle(nodeA, nodeB, 'r', 'r')).toBe(false);
    });

    it('allows any connection when handle IDs are missing', () => {
      const nodeA = createNode('a', 0, 0);
      const nodeB = createNode('b', 100, 100);

      expect(isValidTargetHandle(nodeA, nodeB, null, 'l')).toBe(true);
      expect(isValidTargetHandle(nodeA, nodeB, 'r', null)).toBe(true);
      expect(isValidTargetHandle(nodeA, nodeB, null, null)).toBe(true);
    });

    it('validates diagonal connections correctly', () => {
      // Node A at top-left, Node B at bottom-right
      const nodeA = createNode('a', 0, 0);
      const nodeB = createNode('b', 200, 200);

      // A's right or bottom handle should work with B's left or top handle
      expect(isValidTargetHandle(nodeA, nodeB, 'r', 'l')).toBe(true);
      expect(isValidTargetHandle(nodeA, nodeB, 'b', 't')).toBe(true);

      // A's left or top handle should NOT work (facing away)
      expect(isValidTargetHandle(nodeA, nodeB, 'l', 'r')).toBe(false);
      expect(isValidTargetHandle(nodeA, nodeB, 't', 'b')).toBe(false);
    });
  });

  describe('areNodesConnected', () => {
    const edges: Edge[] = [
      { id: 'e1', source: 'node-a', target: 'node-b' },
      { id: 'e2', source: 'node-c', target: 'node-d' },
    ];

    it('returns true for direct connection (A → B)', () => {
      expect(areNodesConnected(edges, 'node-a', 'node-b')).toBe(true);
    });

    it('returns true for reverse connection lookup (B → A)', () => {
      // Even though edge is A→B, checking B-A should return true (bidirectional check)
      expect(areNodesConnected(edges, 'node-b', 'node-a')).toBe(true);
    });

    it('returns false when no connection exists', () => {
      expect(areNodesConnected(edges, 'node-a', 'node-c')).toBe(false);
      expect(areNodesConnected(edges, 'node-a', 'node-d')).toBe(false);
    });

    it('returns false for empty edge array', () => {
      expect(areNodesConnected([], 'node-a', 'node-b')).toBe(false);
    });

    it('returns false when checking node against itself', () => {
      expect(areNodesConnected(edges, 'node-a', 'node-a')).toBe(false);
    });
  });

  describe('getNodeDimensions', () => {
    describe('width calculation based on label length', () => {
      it('returns small width for labels with 5 or fewer characters', () => {
        expect(getNodeDimensions('Hi').width).toBe(
          NODE_DIMENSIONS.WIDTH_VALUES.SMALL,
        );
        expect(getNodeDimensions('React').width).toBe(
          NODE_DIMENSIONS.WIDTH_VALUES.SMALL,
        );
      });

      it('returns medium width for labels with 6-8 characters', () => {
        expect(getNodeDimensions('Angular').width).toBe(
          NODE_DIMENSIONS.WIDTH_VALUES.MEDIUM,
        );
        expect(getNodeDimensions('Backbone').width).toBe(
          NODE_DIMENSIONS.WIDTH_VALUES.MEDIUM,
        );
      });

      it('returns large width for labels with more than 8 characters', () => {
        expect(getNodeDimensions('JavaScript').width).toBe(
          NODE_DIMENSIONS.WIDTH_VALUES.LARGE,
        );
        expect(getNodeDimensions('TypeScript Fundamentals').width).toBe(
          NODE_DIMENSIONS.WIDTH_VALUES.LARGE,
        );
      });
    });

    describe('height calculation based on label length and type', () => {
      it('returns base height for short labels on topic nodes', () => {
        const { height } = getNodeDimensions('Short', 'topic');
        expect(height).toBe(NODE_DIMENSIONS.BASE_HEIGHT.TOPIC);
      });

      it('returns base height for short labels on subtopic nodes', () => {
        const { height } = getNodeDimensions('Short', 'subtopic');
        expect(height).toBe(NODE_DIMENSIONS.BASE_HEIGHT.SUBTOPIC);
      });

      it('returns two-line height for long labels (>16 chars)', () => {
        const longLabel = 'A very long label here';
        expect(getNodeDimensions(longLabel, 'topic').height).toBe(
          NODE_DIMENSIONS.TWO_LINE_HEIGHT,
        );
        expect(getNodeDimensions(longLabel, 'subtopic').height).toBe(
          NODE_DIMENSIONS.TWO_LINE_HEIGHT,
        );
      });
    });

    it('accepts Node object as input', () => {
      const node: Node = {
        id: 'test',
        type: 'subtopic',
        position: { x: 0, y: 0 },
        data: { label: 'Testing' },
      };
      const { width, height } = getNodeDimensions(node);
      expect(width).toBe(NODE_DIMENSIONS.WIDTH_VALUES.MEDIUM);
      expect(height).toBe(NODE_DIMENSIONS.BASE_HEIGHT.SUBTOPIC);
    });

    it('defaults to topic type when not specified', () => {
      const { height } = getNodeDimensions('Test');
      expect(height).toBe(NODE_DIMENSIONS.BASE_HEIGHT.TOPIC);
    });
  });

  describe('getNodeCenter', () => {
    it('calculates center from Node object', () => {
      const node: Node = {
        id: 'test',
        type: 'topic',
        position: { x: 100, y: 50 },
        data: { label: 'Test' },
      };
      const center = getNodeCenter(node);

      // Small label = 72px width, short topic = 52px height
      expect(center.x).toBe(100 + 72 / 2);
      expect(center.y).toBe(50 + 52 / 2);
    });

    it('calculates center from position with label and type', () => {
      const position = { x: 200, y: 100 };
      const center = getNodeCenter(position, 'Long Label Text', 'subtopic');

      // 15 chars = 170px width (LARGE), short subtopic = 38px height
      expect(center.x).toBe(200 + 170 / 2);
      expect(center.y).toBe(100 + 38 / 2);
    });

    it('adjusts for two-line height with very long labels', () => {
      const position = { x: 0, y: 0 };
      const longLabel = 'This is definitely longer than sixteen characters';
      const center = getNodeCenter(position, longLabel, 'topic');

      // Height should be TWO_LINE_HEIGHT (75px)
      expect(center.y).toBe(75 / 2);
    });
  });
});

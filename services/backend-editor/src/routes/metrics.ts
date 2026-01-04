/**
 * Performance Metrics API
 *
 * Endpoint for collecting frontend performance metrics during load testing
 */

import { Router, type Request, type Response } from 'express';
import { mdbPersistence } from '../server.js';

const router = Router();

interface PerformanceMetric {
  timestamp: number;
  fps: number;
  avgFrameTime: number;
  heapUsedMB: number;
  heapTotalMB: number;
  yjsDocSize: number;
  yjsNodeCount: number;
  yjsEdgeCount: number;
  yjsUpdateCount: number;
  connectedUsers: number;
  awarenessStates: number;
  renderedNodes: number;
  renderedEdges: number;
  yjsToReactLatency: number;
  reactToDomLatency: number;
  userId?: string;
  roomName?: string;
}

// In-memory storage for metrics (cleared on server restart)
const metricsStore: Map<string, PerformanceMetric[]> = new Map();

/**
 * POST /api/metrics
 * Submit performance metrics (single metric or batch)
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;

    // Handle batch submission from PerformanceMonitor
    if (body.metrics && Array.isArray(body.metrics)) {
      const roomKey = body.roomName || 'default';

      if (!metricsStore.has(roomKey)) {
        metricsStore.set(roomKey, []);
      }

      // Add all metrics from the batch
      body.metrics.forEach((metric: PerformanceMetric) => {
        metricsStore.get(roomKey)!.push(metric);
      });

      console.log(
        `[Metrics] Received ${body.metrics.length} metrics for room: ${roomKey}`,
      );
      res.json({
        success: true,
        count: metricsStore.get(roomKey)!.length,
        received: body.metrics.length,
      });
    }
    // Handle single metric submission (legacy)
    else {
      const metric: PerformanceMetric = body;

      if (!metric.timestamp) {
        return res.status(400).json({ error: 'Missing timestamp' });
      }

      const roomKey = metric.roomName || 'default';

      if (!metricsStore.has(roomKey)) {
        metricsStore.set(roomKey, []);
      }

      metricsStore.get(roomKey)!.push(metric);

      res.json({ success: true, count: metricsStore.get(roomKey)!.length });
    }
  } catch (error) {
    console.error('Error storing metrics:', error);
    res.status(500).json({ error: 'Failed to store metrics' });
  }
});

/**
 * GET /api/metrics
 * Retrieve all metrics or filter by room
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { room } = req.query;

    if (room) {
      const metrics = metricsStore.get(room as string) || [];
      res.json({ room, count: metrics.length, metrics });
    } else {
      // Return all metrics grouped by room
      const allMetrics: Record<string, PerformanceMetric[]> = {};
      metricsStore.forEach((metrics, roomKey) => {
        allMetrics[roomKey] = metrics;
      });
      res.json({ rooms: Object.keys(allMetrics), metrics: allMetrics });
    }
  } catch (error) {
    console.error('Error retrieving metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/metrics/summary
 * Get aggregated metrics summary
 * Note: Public endpoint for load testing (no auth required)
 */
router.get('/summary', (req: Request, res: Response) => {
  try {
    const { room } = req.query;
    const roomKey = (room as string) || 'default';
    const metrics = metricsStore.get(roomKey) || [];

    if (metrics.length === 0) {
      return res.json({ room: roomKey, count: 0, summary: null });
    }

    // Calculate averages
    const summary = {
      count: metrics.length,
      duration: metrics[metrics.length - 1].timestamp - metrics[0].timestamp,
      fps: {
        avg: avg(metrics.map((m) => m.fps)),
        min: Math.min(...metrics.map((m) => m.fps)),
        max: Math.max(...metrics.map((m) => m.fps)),
      },
      memory: {
        avgUsedMB: avg(metrics.map((m) => m.heapUsedMB)),
        maxUsedMB: Math.max(...metrics.map((m) => m.heapUsedMB)),
      },
      yjs: {
        avgNodeCount: avg(metrics.map((m) => m.yjsNodeCount)),
        avgEdgeCount: avg(metrics.map((m) => m.yjsEdgeCount)),
        totalUpdates: metrics[metrics.length - 1].yjsUpdateCount,
      },
      collaboration: {
        avgConnectedUsers: avg(metrics.map((m) => m.connectedUsers)),
        maxConnectedUsers: Math.max(...metrics.map((m) => m.connectedUsers)),
      },
      latency: {
        avgYjsToReact: avg(metrics.map((m) => m.yjsToReactLatency)),
        avgReactToDom: avg(metrics.map((m) => m.reactToDomLatency)),
      },
    };

    res.json({ room: roomKey, summary });
  } catch (error) {
    console.error('Error calculating summary:', error);
    res.status(500).json({ error: 'Failed to calculate summary' });
  }
});

/**
 * DELETE /api/metrics
 * Clear all metrics
 */
router.delete('/', (req: Request, res: Response) => {
  try {
    const { room } = req.query;

    if (room) {
      metricsStore.delete(room as string);
      res.json({ success: true, message: `Cleared metrics for room: ${room}` });
    } else {
      metricsStore.clear();
      res.json({ success: true, message: 'Cleared all metrics' });
    }
  } catch (error) {
    console.error('Error clearing metrics:', error);
    res.status(500).json({ error: 'Failed to clear metrics' });
  }
});

/**
 * POST /api/metrics/export
 * Export metrics to JSON file
 */
router.post('/export', (req: Request, res: Response) => {
  try {
    const { room } = req.query;
    const roomKey = (room as string) || 'default';
    const metrics = metricsStore.get(roomKey) || [];

    const exportData = {
      room: roomKey,
      exportedAt: new Date().toISOString(),
      count: metrics.length,
      metrics,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="metrics-${roomKey}-${Date.now()}.json"`,
    );
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

/**
 * DELETE /api/metrics/cleanup-room
 * Clear Yjs document from MongoDB for a test room
 * Note: Only clears rooms starting with 'TestCommunity/' for safety
 */
router.delete('/cleanup-room', async (req: Request, res: Response) => {
  try {
    const { room } = req.query;

    if (!room || typeof room !== 'string') {
      return res.status(400).json({ error: 'Room name required' });
    }

    // Safety check: only allow cleanup of test rooms
    if (!room.startsWith('TestCommunity/')) {
      return res.status(403).json({
        error: 'Can only cleanup test rooms (must start with TestCommunity/)',
      });
    }

    // Clear the Yjs document from MongoDB
    await mdbPersistence.clearDocument(room);

    console.log(`[Cleanup] Cleared Yjs document for room: ${room}`);
    res.json({ success: true, message: `Cleared document for room: ${room}` });
  } catch (error) {
    console.error('Error clearing room document:', error);
    res.status(500).json({ error: 'Failed to clear room document' });
  }
});

// Helper function to calculate average
function avg(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return (
    Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 100) /
    100
  );
}

export default router;

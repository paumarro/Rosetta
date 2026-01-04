/**
 * Performance Metrics Collector for Collaborative Editor
 *
 * Collects real-time performance metrics including:
 * - FPS (frames per second)
 * - Memory usage
 * - Yjs document metrics
 * - Collaboration metrics
 * - Rendering performance
 */

import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';

export interface PerformanceMetrics {
  timestamp: number;

  // Rendering performance
  fps: number;
  avgFrameTime: number; // ms

  // Memory usage
  heapUsedMB: number;
  heapTotalMB: number;

  // Yjs metrics
  yjsDocSize: number; // bytes
  yjsNodeCount: number;
  yjsEdgeCount: number;
  yjsUpdateCount: number;

  // Collaboration metrics
  connectedUsers: number;
  awarenessStates: number;

  // React Flow metrics
  renderedNodes: number;
  renderedEdges: number;

  // Performance timings
  yjsToReactLatency: number; // ms - time from Yjs update to React state
  reactToDomLatency: number; // ms - time from React state to DOM
}

// Type for browser memory API (non-standard)
interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

class PerformanceMonitor {
  private frameCount = 0;
  private frameTimes: number[] = [];
  private lastFrameTime = performance.now();
  private lastFpsUpdate = performance.now();
  private currentFps = 60;
  private rafId: number | null = null;
  private isRunning = false;

  // Yjs update tracking
  private yjsUpdateCount = 0;
  private lastYjsUpdate = 0;
  private lastReactUpdate = 0;

  /**
   * Start monitoring performance
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.measureFPS();
  }

  /**
   * Stop monitoring performance
   */
  stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Measure FPS using requestAnimationFrame
   */
  private measureFPS = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame times for average calculation
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    this.frameCount++;

    // Update FPS every second
    if (now >= this.lastFpsUpdate + 1000) {
      this.currentFps = Math.round(
        (this.frameCount * 1000) / (now - this.lastFpsUpdate),
      );
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    this.rafId = requestAnimationFrame(this.measureFPS);
  };

  /**
   * Track Yjs update event
   */
  onYjsUpdate() {
    this.yjsUpdateCount++;
    this.lastYjsUpdate = performance.now();
  }

  /**
   * Track React state update event
   */
  onReactUpdate() {
    this.lastReactUpdate = performance.now();
  }

  /**
   * Get current metrics
   */
  getMetrics(
    ydoc: Y.Doc | null,
    awareness: Awareness | null,
    reactNodes: unknown[],
    reactEdges: unknown[],
  ): PerformanceMetrics {
    const perfWithMemory = performance as PerformanceWithMemory;
    const memory = perfWithMemory.memory ?? {
      usedJSHeapSize: 0,
      totalJSHeapSize: 0,
    };

    // Calculate Yjs document size
    const yNodes = ydoc?.getMap('nodes');
    const yEdges = ydoc?.getMap('edges');

    // Calculate latencies
    const yjsToReactLatency = this.lastReactUpdate - this.lastYjsUpdate;
    const reactToDomLatency = performance.now() - this.lastReactUpdate;

    // Average frame time
    const avgFrameTime =
      this.frameTimes.length > 0
        ? this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
        : 0;

    return {
      timestamp: Date.now(),

      // Rendering
      fps: this.currentFps,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,

      // Memory
      heapUsedMB: Math.round((memory.usedJSHeapSize / 1024 / 1024) * 100) / 100,
      heapTotalMB:
        Math.round((memory.totalJSHeapSize / 1024 / 1024) * 100) / 100,

      // Yjs
      yjsDocSize: 0, // Can be calculated with Y.encodeStateAsUpdate if needed
      yjsNodeCount: yNodes?.size ?? 0,
      yjsEdgeCount: yEdges?.size ?? 0,
      yjsUpdateCount: this.yjsUpdateCount,

      // Collaboration
      connectedUsers: awareness?.getStates().size ?? 0,
      awarenessStates: awareness?.getStates().size ?? 0,

      // React Flow
      renderedNodes: reactNodes.length,
      renderedEdges: reactEdges.length,

      // Latencies
      yjsToReactLatency: Math.max(0, yjsToReactLatency),
      reactToDomLatency: Math.max(0, reactToDomLatency),
    };
  }

  /**
   * Reset counters
   */
  reset() {
    this.yjsUpdateCount = 0;
    this.frameTimes = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

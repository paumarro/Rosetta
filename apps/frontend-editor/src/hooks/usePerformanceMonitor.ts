/**
 * React hook for performance monitoring
 *
 * Usage:
 * const metrics = usePerformanceMonitor({ enabled: true, interval: 5000 });
 */

import { useEffect, useState } from 'react';
import { useCollaborativeStore } from '@/store/collaborationStore';
import {
  performanceMonitor,
  type PerformanceMetrics,
} from '@/utils/performanceMetrics';

interface UsePerformanceMonitorOptions {
  enabled?: boolean;
  interval?: number; // ms between metric collections
  onMetrics?: (metrics: PerformanceMetrics) => void;
}

export function usePerformanceMonitor(
  options: UsePerformanceMonitorOptions = {},
) {
  const { enabled = false, interval = 5000, onMetrics } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const { ydoc, awareness, nodes, edges } = useCollaborativeStore();

  useEffect(() => {
    if (!enabled) {
      console.log('[usePerformanceMonitor] Disabled, skipping');
      return;
    }

    console.log('[usePerformanceMonitor] Starting monitoring', {
      hasYdoc: !!ydoc,
      hasAwareness: !!awareness,
      interval,
    });

    // Start FPS monitoring
    performanceMonitor.start();

    // Collect metrics periodically
    const intervalId = setInterval(() => {
      if (ydoc && awareness) {
        const currentMetrics = performanceMonitor.getMetrics(
          ydoc,
          awareness,
          nodes,
          edges,
        );

        console.log(
          '[usePerformanceMonitor] Collected metrics:',
          currentMetrics,
        );
        setMetrics(currentMetrics);

        // Call callback if provided
        if (onMetrics) {
          onMetrics(currentMetrics);
        }
      } else {
        console.log('[usePerformanceMonitor] Waiting for Yjs connection', {
          hasYdoc: !!ydoc,
          hasAwareness: !!awareness,
        });
      }
    }, interval);

    return () => {
      clearInterval(intervalId);
      performanceMonitor.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval, ydoc, awareness]);

  // Track Yjs updates
  useEffect(() => {
    if (!enabled || !ydoc) return;

    const handleUpdate = () => {
      performanceMonitor.onYjsUpdate();
    };

    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
    };
  }, [enabled, ydoc]);

  // Track React state updates
  useEffect(() => {
    if (!enabled) return;
    performanceMonitor.onReactUpdate();
  }, [enabled, nodes, edges]);

  return metrics;
}

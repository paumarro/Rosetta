/**
 * Performance Monitor Component
 *
 * Automatically collects and reports performance metrics in test mode.
 * Metrics are sent to the backend API for aggregation and analysis.
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { isTestMode } from '@/utils/testMode';
import type { PerformanceMetrics } from '@/utils/performanceMetrics';

interface PerformanceMonitorProps {
  roomName: string;
  enabled?: boolean;
}

interface MetricsBatch {
  roomName: string;
  metrics: PerformanceMetrics[];
  timestamp: number;
}

/* eslint-disable react/prop-types */
export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  roomName,
  enabled = true,
}) => {
  /* eslint-enable react/prop-types */
  const metricsRef = useRef<PerformanceMetrics[]>([]);
  const lastReportTime = useRef(Date.now());

  const reportMetrics = useCallback(async () => {
    if (metricsRef.current.length === 0) return;

    try {
      const batch: MetricsBatch = {
        roomName,
        metrics: metricsRef.current,
        timestamp: Date.now(),
      };

      const response = await fetch('/editor/api/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        metricsRef.current = [];
        lastReportTime.current = Date.now();
      } else {
        console.error(
          '[PerformanceMonitor] Failed to report metrics:',
          response.status,
        );
      }
    } catch (error) {
      console.error('[PerformanceMonitor] Error reporting metrics:', error);
    }
  }, [roomName]);

  // Collect metrics every 5 seconds
  const metrics = usePerformanceMonitor({
    enabled: enabled && isTestMode(),
    interval: 5000,
    onMetrics: (currentMetrics) => {
      // Store metrics locally
      metricsRef.current.push(currentMetrics);

      // Report to backend every 30 seconds or when we have 10+ samples
      const now = Date.now();
      const shouldReport =
        now - lastReportTime.current >= 30000 ||
        metricsRef.current.length >= 10;

      if (shouldReport) {
        void reportMetrics();
      }
    },
  });

  // Report remaining metrics on unmount
  useEffect(() => {
    return () => {
      console.log(
        '[PerformanceMonitor] Component unmounting, reporting remaining metrics',
      );
      if (metricsRef.current.length > 0) {
        // Use void to ensure we don't block unmount
        void reportMetrics();
      }
    };
  }, [reportMetrics]);

  // Display metrics in test mode
  if (!enabled || !isTestMode() || !metrics) {
    console.log('[PerformanceMonitor] Not rendering:', {
      enabled,
      isTestMode: isTestMode(),
      hasMetrics: !!metrics,
    });
    return null;
  }

  console.log('[PerformanceMonitor] Rendering overlay with metrics:', metrics);

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono max-w-md z-50">
      <div className="font-bold mb-2 flex items-center gap-2">
        Performance Monitor
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>FPS:</div>
        <div className={metrics.fps < 30 ? 'text-red-400' : 'text-green-400'}>
          {metrics.fps}
        </div>

        <div>Memory:</div>
        <div>{metrics.heapUsedMB.toFixed(1)} MB</div>

        <div>Nodes:</div>
        <div>
          {metrics.yjsNodeCount} (Yjs) / {metrics.renderedNodes} (DOM)
        </div>

        <div>Users:</div>
        <div>{metrics.connectedUsers}</div>

        <div>Updates:</div>
        <div>{metrics.yjsUpdateCount}</div>

        <div>Yjs→React:</div>
        <div
          className={metrics.yjsToReactLatency > 100 ? 'text-yellow-400' : ''}
        >
          {metrics.yjsToReactLatency.toFixed(1)} ms
        </div>

        <div>React→DOM:</div>
        <div
          className={metrics.reactToDomLatency > 100 ? 'text-yellow-400' : ''}
        >
          {metrics.reactToDomLatency.toFixed(1)} ms
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;

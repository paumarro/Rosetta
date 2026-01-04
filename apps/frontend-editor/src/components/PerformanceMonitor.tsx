/**
 * Performance Monitor Component
 *
 * Automatically collects and reports performance metrics in test mode.
 * Metrics are sent to the backend API for aggregation and analysis.
 */

import { useEffect, useRef } from 'react';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import { isTestMode } from './TestUserProvider';

interface PerformanceMonitorProps {
  roomName: string;
  enabled?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  roomName,
  enabled = true,
}) => {
  const metricsRef = useRef<any[]>([]);
  const lastReportTime = useRef(Date.now());

  // Collect metrics every 5 seconds
  const metrics = usePerformanceMonitor({
    enabled: enabled && isTestMode(),
    interval: 5000,
    onMetrics: async (currentMetrics) => {
      // Store metrics locally
      metricsRef.current.push({
        ...currentMetrics,
        roomName,
      });

      // Report to backend every 30 seconds or when we have 10+ samples
      const now = Date.now();
      const shouldReport =
        now - lastReportTime.current >= 30000 ||
        metricsRef.current.length >= 10;

      if (shouldReport) {
        await reportMetrics();
      }
    },
  });

  const reportMetrics = async () => {
    if (metricsRef.current.length === 0) return;

    try {
      // Send metrics to backend-editor via /editor proxy
      // Vite rewrites /editor/metrics → /api/metrics
      const response = await fetch('/editor/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          metrics: metricsRef.current,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        console.log(
          `[PerformanceMonitor] Reported ${metricsRef.current.length} metrics`,
        );
        metricsRef.current = [];
        lastReportTime.current = Date.now();
      }
    } catch (error) {
      console.error('[PerformanceMonitor] Failed to report metrics:', error);
    }
  };

  // Report remaining metrics on unmount
  useEffect(() => {
    return () => {
      if (metricsRef.current.length > 0) {
        reportMetrics();
      }
    };
  }, []);

  // Display metrics in test mode
  if (!enabled || !isTestMode() || !metrics) {
    return null;
  }

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

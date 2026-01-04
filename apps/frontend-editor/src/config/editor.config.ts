/**
 * Editor Configuration
 *
 * Centralized configuration for the diagram editor.
 * Modify these values to customize editor behavior.
 */

/** Navigation routes */
export const ROUTES = {
  HOME: '/',
  HUB: (community: string) => `/hub/${encodeURIComponent(community)}`,
  LOGIN: '/login',
} as const;

/** ReactFlow diagram settings */
export const DIAGRAM_CONFIG = {
  /** Fit view animation settings */
  FIT_VIEW: {
    PADDING: 0.2, // 20% padding around nodes
    DURATION: 800, // milliseconds
  },

  /** Snap to grid settings */
  SNAP_GRID: [15, 15] as const,

  /** Zoom limits */
  ZOOM: {
    MIN: 0.8,
    MAX: 1.8,
  },

  /** Connection radius for edge creation */
  CONNECTION_RADIUS: 50,
} as const;

/** Performance and throttling settings */
export const PERFORMANCE_CONFIG = {
  /** Cursor position update throttle (ms) */
  CURSOR_THROTTLE: 50, // 20 updates per second

  /** Metrics collection interval (ms) */
  METRICS_INTERVAL: 5000, // 5 seconds

  /** Metrics reporting interval (ms) */
  METRICS_REPORT_INTERVAL: 30000, // 30 seconds
} as const;

/** Node label display settings */
export const NODE_LABEL_CONFIG = {
  /** Maximum label length before truncation */
  MAX_LENGTH: 32,

  /** Length threshold for splitting into two lines */
  THRESHOLD: 16,

  /** Search range for finding word break point */
  BREAK_SEARCH_RANGE: 4,
} as const;

/** WebSocket configuration */
export const WEBSOCKET_CONFIG = {
  /** Default WebSocket port for development */
  DEFAULT_PORT: 5173,

  /** WebSocket connection timeout (ms) */
  SYNC_TIMEOUT: 10000,
} as const;

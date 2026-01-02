/**
 * Avatar color palette for collaborative users
 * Professional UI colors that work well on gray backgrounds
 */
export const AVATAR_COLORS = [
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Purple
  '#f43f5e', // Rose
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#0ea5e9', // Sky
  '#ec4899', // Pink
  '#f97316', // Orange
  '#06b6d4', // Cyan
] as const;

/**
 * WebSocket sync timeout in milliseconds
 */
export const SYNC_TIMEOUT_MS = 30000;

/**
 * Delay to wait for backend to apply persisted Yjs state after initial sync
 * The backend's bindState is async, so persisted state may arrive after the sync event
 */
export const BACKEND_STATE_SYNC_DELAY_MS = 100;

/**
 * Threshold in milliseconds after which a node lock is considered stale.
 * Stale locks can be forcibly released (e.g., if user closed browser without cleanup).
 * Locks persist across navigation/page refresh, but become stale after this timeout.
 * Default: 5 minutes - allows user to refresh page or navigate back within reasonable time
 */
export const LOCK_STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Interval in milliseconds for awareness heartbeat.
 * Yjs Awareness has a default timeout of 30 seconds - if no updates are received,
 * a user is considered "outdated" and removed. This heartbeat keeps the connection alive.
 * Default: 15 seconds (half the timeout to ensure we stay well under the threshold)
 */
export const AWARENESS_HEARTBEAT_INTERVAL_MS = 15 * 1000;

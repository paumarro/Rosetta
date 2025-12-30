/**
 * Storage Abstraction Layer
 *
 * Centralizes all localStorage operations with type-safe keys and error handling.
 */

// Storage key constants
const STORAGE_KEYS = {
  RECENTLY_VIEWED: 'rosetta_recently_viewed',
  nodeCompletion: (learningPathId: string, nodeId: string) =>
    `node-${learningPathId}-${nodeId}-completed`,
} as const;

const MAX_RECENTLY = 9;

/**
 * Recently Viewed Diagrams
 */
export const addToRecentlyViewed = (pathId: string): void => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.RECENTLY_VIEWED);
    let recent: string[] = stored ? (JSON.parse(stored) as string[]) : [];

    // Remove duplicate if exists
    recent = recent.filter((id) => id !== pathId);

    // Add to beginning
    recent.unshift(pathId);

    // Keep only max items
    recent = recent.slice(0, MAX_RECENTLY);

    localStorage.setItem(STORAGE_KEYS.RECENTLY_VIEWED, JSON.stringify(recent));
  } catch (error) {
    console.error('Failed to update recently viewed:', error);
  }
};

/**
 * Node Completion State
 */
export const getNodeCompletion = (
  learningPathId: string,
  nodeId: string,
): boolean => {
  try {
    const key = STORAGE_KEYS.nodeCompletion(learningPathId, nodeId);
    return localStorage.getItem(key) === 'true';
  } catch (error) {
    console.error('Failed to get node completion state:', error);
    return false;
  }
};

export const setNodeCompletion = (
  learningPathId: string,
  nodeId: string,
  completed: boolean,
): void => {
  try {
    const key = STORAGE_KEYS.nodeCompletion(learningPathId, nodeId);
    localStorage.setItem(key, String(completed));
  } catch (error) {
    console.error('Failed to set node completion state:', error);
  }
};

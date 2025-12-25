const MAX_RECENTLY = 9;
const RECENTLY_VIEWED_KEY = 'rosetta_recently_viewed';

export const addToRecentlyViewed = (pathId: string) => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    let recent: string[] = stored ? (JSON.parse(stored) as string[]) : [];

    // Remove duplicate if exists
    recent = recent.filter((id) => id !== pathId);

    // Add to beginning
    recent.unshift(pathId);

    // Keep only max items
    recent = recent.slice(0, MAX_RECENTLY);

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent));
  } catch (error) {
    console.error('Failed to update recently viewed:', error);
  }
};

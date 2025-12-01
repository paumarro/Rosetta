const MAX_RECENTLY = 9;
const RECENTLY_VIEWED_KEY = 'rosetta_recently_viewed';

export const addToRecentlyViewed = (pathId: string) => {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    let recent: string[] = stored ? (JSON.parse(stored) as string[]) : [];

    // Remove duplicate id exists
    recent = recent.filter((id) => id !== pathId);

    recent.unshift(pathId);

    recent = recent.slice(0, MAX_RECENTLY);

    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent));
  } catch (error) {
    console.log('Failed to update recently viewed:', error);
  }
};

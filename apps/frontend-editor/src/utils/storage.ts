const MAX_RECENTLY = 9;
const RECENTLY_VIEWED_KEY = 'rosetta_recently_viewed';

export const addToRecentlyViewed = (pathId: string) => {
  console.log('[storage] addToRecentlyViewed called with:', pathId);
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    console.log('[storage] Current localStorage value:', stored);

    let recent: string[] = stored ? (JSON.parse(stored) as string[]) : [];
    console.log('[storage] Parsed array:', recent);

    const lengthBefore = recent.length;
    // Remove duplicate if exists
    recent = recent.filter((id) => id !== pathId);
    console.log('[storage] After duplicate filter:', {
      removed: lengthBefore - recent.length,
      array: recent,
    });

    recent.unshift(pathId);
    console.log('[storage] After unshift:', recent);

    recent = recent.slice(0, MAX_RECENTLY);

    const newValue = JSON.stringify(recent);
    console.log('[storage] Saving to localStorage:', newValue);
    localStorage.setItem(RECENTLY_VIEWED_KEY, newValue);

    // Verify save
    const verify = localStorage.getItem(RECENTLY_VIEWED_KEY);
    console.log('[storage] Verification read:', verify);
  } catch (error) {
    console.log('[storage] Failed to update recently viewed:', error);
  }
};

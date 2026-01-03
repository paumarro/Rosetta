import { useEffect, useState } from 'react';
import type { LearningPath } from '@/types/learningPath';
import type { FilterType, SortType } from '@/types/organize';
import { FILTER_OPTIONS, SORT_OPTIONS } from '@/types/organize';

interface UsePathOrganizerProps {
  allPaths: LearningPath[];
  isFavorited: (id: string) => boolean;
  favorites: LearningPath[];
}

/** Filters and sorts learning paths by all/recently viewed/bookmarked and by last update/alphabetically */
export function usePathOrganizer({
  allPaths,
  isFavorited,
  favorites,
}: UsePathOrganizerProps) {
  const [filter, setFilter] = useState<FilterType>(FILTER_OPTIONS.ALL);
  const [order, setOrder] = useState<SortType>(SORT_OPTIONS.LAST_UPDATE);
  const [organizedPaths, setOrganizedPaths] = useState<LearningPath[]>([]);

  useEffect(() => {
    let filteredPaths = [...allPaths];

    // Apply filter
    switch (filter) {
      case FILTER_OPTIONS.RECENTLY_VIEWED: {
        // Get recently viewed LPs directly from localStorage
        const stored = localStorage.getItem('rosetta_recently_viewed');

        if (stored) {
          const recentLPs: string[] = JSON.parse(stored) as string[];

          // Match by canonical ID
          filteredPaths = filteredPaths.filter((p) => recentLPs.includes(p.ID));

          // Sort by recency - order in recentLPs array (most recent first)
          filteredPaths.sort((a, b) => {
            const indexA = recentLPs.indexOf(a.ID);
            const indexB = recentLPs.indexOf(b.ID);
            return indexA - indexB;
          });
        } else {
          filteredPaths = [];
        }
        break;
      }
      case FILTER_OPTIONS.BOOKMARKED:
        filteredPaths = filteredPaths.filter((p) => isFavorited(p.ID));
        break;
      case FILTER_OPTIONS.ALL:
      default:
        // No filtering
        break;
    }

    // Apply sort (only if not Recently Viewed, which has its own sort)
    if (filter !== FILTER_OPTIONS.RECENTLY_VIEWED) {
      switch (order) {
        case SORT_OPTIONS.LAST_UPDATE:
          filteredPaths.sort(
            (a, b) =>
              new Date(b.UpdatedAt).getTime() - new Date(a.UpdatedAt).getTime(),
          );
          break;
        case SORT_OPTIONS.ALPHABETICAL:
          filteredPaths.sort((a, b) => a.Title.localeCompare(b.Title));
          break;
      }
    }

    setOrganizedPaths(filteredPaths);
  }, [filter, order, allPaths, favorites, isFavorited]);

  return {
    filter,
    order,
    organizedPaths,
    setFilter,
    setOrder,
  };
}

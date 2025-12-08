import { useEffect, useState } from 'react';
import type { LearningPath } from '@/types/learningPath';
import type { FilterType, SortType } from '@/types/organize';
import { FILTER_OPTIONS, SORT_OPTIONS } from '@/types/organize';

interface UsePathOrganizerProps {
  allPaths: LearningPath[];
  isFavorited: (id: string) => boolean;
  favorites: LearningPath[];
}

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
        // Get recently viewed IDs directly from localStorage
        const stored = localStorage.getItem('rosetta_recently_viewed');
        if (stored) {
          const recentIds: string[] = JSON.parse(stored) as string[];
          filteredPaths = filteredPaths.filter((p) => recentIds.includes(p.ID));
          // Sort by recency - order in recentIds array (most recent first)
          filteredPaths.sort((a, b) => {
            const indexA = recentIds.indexOf(a.ID);
            const indexB = recentIds.indexOf(b.ID);
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

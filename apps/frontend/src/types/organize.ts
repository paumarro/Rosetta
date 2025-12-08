export type FilterType = 'All' | 'Recently Viewed' | 'Bookmarked';
export type SortType = 'Last Update' | 'alphabetical';

export const FILTER_OPTIONS = {
  ALL: 'All' as FilterType,
  RECENTLY_VIEWED: 'Recently Viewed' as FilterType,
  BOOKMARKED: 'Bookmarked' as FilterType,
};

export const SORT_OPTIONS = {
  LAST_UPDATE: 'Last Update' as SortType,
  ALPHABETICAL: 'alphabetical' as SortType,
};

export const FILTER_LABELS: Record<FilterType, string> = {
  All: 'Entire Catalog',
  'Recently Viewed': 'Last Viewed',
  Bookmarked: 'Bookmarked',
};

export const SORT_LABELS: Record<SortType, string> = {
  'Last Update': 'Last Update',
  alphabetical: 'Alphabetical',
};

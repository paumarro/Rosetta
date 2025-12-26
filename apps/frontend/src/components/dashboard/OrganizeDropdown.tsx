import type { FilterType, SortType } from '@/types/organize';
import {
  FILTER_OPTIONS,
  SORT_OPTIONS,
  FILTER_LABELS,
  SORT_LABELS,
} from '@/types/organize';
import { Button } from '@/components/ui/button';

interface OrganizeDropdownProps {
  isOpen: boolean;
  filter: FilterType;
  order: SortType;
  onFilterChange: (filter: FilterType) => void;
  onSortChange: (order: SortType) => void;
  onClose: () => void;
}

export function OrganizeDropdown({
  isOpen,
  filter,
  order,
  onFilterChange,
  onSortChange,
  onClose,
}: OrganizeDropdownProps) {
  const handleFilterClick = (newFilter: FilterType) => {
    onFilterChange(newFilter);
    onClose();
  };

  const handleSortClick = (newOrder: SortType) => {
    if (filter !== FILTER_OPTIONS.RECENTLY_VIEWED) {
      onSortChange(newOrder);
      onClose();
    }
  };

  const isSortDisabled = filter === FILTER_OPTIONS.RECENTLY_VIEWED;

  return (
    <div
      className={`transition-all duration-500 ease-in-out ${
        isOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
      }`}
      style={{
        overflow: isOpen ? 'visible' : 'hidden',
      }}
    >
      <div className="py-6 flex justify-end">
        <div className="flex gap-12 items-start">
          {/* Filter Column */}
          <>
            <div className="text-gray-400 text-sm">Filter by</div>
            <div className="flex flex-col gap-3 items-end">
              {Object.values(FILTER_OPTIONS).map((filterOption) => (
                <Button
                  key={filterOption}
                  variant="ghost"
                  onClick={() => {
                    handleFilterClick(filterOption);
                  }}
                  className={`text-sm transition-colors duration-300 h-auto py-0 px-0 ${
                    filter === filterOption
                      ? 'text-red-500'
                      : 'hover:text-red-500'
                  }`}
                >
                  {FILTER_LABELS[filterOption]}
                </Button>
              ))}
            </div>
          </>

          {/* Sort Column */}
          <>
            <div className="ml-5 text-gray-400 text-sm">Sort by</div>
            <div className="flex flex-col gap-3 items-end">
              {Object.values(SORT_OPTIONS).map((sortOption) => (
                <Button
                  key={sortOption}
                  variant="ghost"
                  onClick={() => {
                    handleSortClick(sortOption);
                  }}
                  disabled={isSortDisabled}
                  className={`text-sm transition-colors duration-300 h-auto py-0 px-0 ${
                    isSortDisabled
                      ? 'text-gray-400 cursor-not-allowed'
                      : order === sortOption
                        ? 'text-red-500'
                        : 'hover:text-red-500'
                  }`}
                >
                  {SORT_LABELS[sortOption]}
                </Button>
              ))}
            </div>
          </>
        </div>
      </div>
    </div>
  );
}

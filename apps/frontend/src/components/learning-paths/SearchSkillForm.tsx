import { Label } from '@/components/ui/Label';
import { SidebarInput } from '@/components/ui/Sidebar';
import { cn } from '@shared/utils';

interface SearchFormProps
  extends Omit<React.ComponentProps<'form'>, 'onSubmit'> {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

/**
 * Search form component for filtering skills/learning paths.
 * Triggers search on Enter key press.
 * @param props - Component props
 * @param props.inputValue - Current search input value
 * @param props.onInputChange - Callback when input value changes
 * @param props.onSearch - Callback when search is triggered
 * @param props.placeholder - Input placeholder text
 * @param props.inputClassName - Additional CSS classes for input
 * @returns Search input form component
 */
export function SearchSkillForm({
  inputValue,
  onInputChange,
  onSearch,
  placeholder = 'Type to search...',
  inputClassName,
}: SearchFormProps): React.ReactElement {
  return (
    <div className="relative">
      <Label className="sr-only">Search</Label>
      <SidebarInput
        id="search"
        value={inputValue}
        onChange={(e) => {
          onInputChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSearch(inputValue);
          }
        }}
        placeholder={placeholder}
        className={cn('h-8 pl-7', inputClassName)}
      />
    </div>
  );
}

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

/** Search form for filtering skills/learning paths (triggers search on Enter key) */
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

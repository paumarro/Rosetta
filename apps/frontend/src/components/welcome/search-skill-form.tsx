import { Label } from '@/components/ui/label';
import { SidebarInput } from '@/components/ui/sidebar';
import { cn } from '@/utils/cn';

interface SearchFormProps
  extends Omit<React.ComponentProps<'form'>, 'onSubmit'> {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  inputClassName?: string;
}

export function SearchSkillForm({
  inputValue,
  onInputChange,
  onSearch,
  placeholder = 'Type to search...',
  inputClassName,
}: SearchFormProps) {
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

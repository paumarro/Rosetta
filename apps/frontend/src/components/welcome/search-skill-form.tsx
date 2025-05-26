import { Search } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { SidebarInput } from '@/components/ui/sidebar';
import { FormEvent } from 'react';

interface SearchFormProps
  extends Omit<React.ComponentProps<'form'>, 'onSubmit'> {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
}

export function SearchSkillForm({
  inputValue,
  onInputChange,
  onSearch,
  placeholder = 'Type to search...',
  ...props
}: SearchFormProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(inputValue);
  };
  return (
    <form onSubmit={handleSubmit} {...props}>
      <div className="relative">
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        <SidebarInput
          id="search"
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value);
          }}
          placeholder={placeholder}
          className="h-8 pl-7"
        />
        <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
      </div>
    </form>
  );
}

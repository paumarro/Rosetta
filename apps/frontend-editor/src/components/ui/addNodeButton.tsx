import { Button } from '@/components/ui/button';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { Plus, RectangleHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

export default function AddNodeButton() {
  const { addNode } = useCollaborativeStore();
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          onMouseEnter={() => {
            setOpen(true);
          }}
          className="hover:bg-black hover:text-white hover:scale-110 hover:shadow-none w-14 h-14 rounded-full 
        transition duration-300 ease-in-out [&_svg]:!size-auto shadow-[0_0_20px_rgba(0,0,0,0.40)]
        data-[state=open]:bg-black data-[state=open]:text-white data-[state=open]:scale-110
        data-[state=open]:shadow-none
        "
          variant={'outline'}
        >
          <Plus size={28} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-black"
        side="right"
        onMouseLeave={() => {
          setOpen(false);
        }}
      >
        <DropdownMenuItem
          onClick={() => {
            addNode('topic');
          }}
          className="flex items-center gap-2 cursor-pointer text-white hover:!text-black [&>svg]:!text-white hover:[&>svg]:!text-black"
        >
          <RectangleHorizontal className="w-4 h-4" fill="currentColor" />
          <span>Main</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            addNode('subtopic');
          }}
          className="flex items-center gap-2 cursor-pointer text-white hover:!text-black [&>svg]:!text-white hover:[&>svg]:!text-black"
        >
          <RectangleHorizontal className="w-4 h-4" />
          <span>Section</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

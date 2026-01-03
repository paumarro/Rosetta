import { Button } from '@/components/ui/button';
import { useCollaborativeStore } from '@/store/collaborationStore';
import { Plus, RectangleHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
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
          className="hover:bg-black hover:text-white hover:scale-120 hover:shadow-none w-14 h-14 rounded-full 
        transition duration-300 ease-in-out [&_svg]:!size-auto shadow-[0_0_20px_rgba(0,0,0,0.1)]
        data-[state=open]:bg-black data-[state=open]:text-white data-[state=open]:scale-110
        data-[state=open]:shadow-none
        "
          variant={'outline'}
        >
          <Plus size={28} strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="bg-black !w-[130px] !min-w-[20px]"
        side="top"
        onMouseLeave={() => {
          setOpen(false);
        }}
      >
        <DropdownMenuItem
          onClick={() => {
            addNode('topic');
          }}
          className="flex items-center gap-2 cursor-pointer text-[12px] text-white hover:!text-black [&>svg]:!text-white hover:[&>svg]:!text-black pl-[10px]"
        >
          <RectangleHorizontal className="size-5" fill="currentColor" />
          <span>Topic</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            addNode('subtopic');
          }}
          className="flex items-center gap-2 cursor-pointer text-[12px] text-white hover:!text-black [&>svg]:!text-white hover:[&>svg]:!text-black pl-[10px]"
        >
          <RectangleHorizontal className="size-5" />
          <span>Subtopic</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

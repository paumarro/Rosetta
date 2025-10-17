import { Button } from '@/components/ui/button';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { Trash2 } from 'lucide-react';

export default function RemoveAllButton() {
  const { deleteAllNodes } = useCollaborativeStore();
  return (
    <Button
      onClick={() => {
        deleteAllNodes();
      }}
    >
      <Trash2 size={24} />
    </Button>
  );
}

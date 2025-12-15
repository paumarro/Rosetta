import { useNavigate, useParams } from 'react-router-dom';
import { useUserStore } from '@/stores/userStore';
import { Pen } from 'lucide-react';

interface EditButtonProps {
  community?: string;
}

/**
 * EditButton - Displays an edit button for users who have permission to edit
 *
 * Only visible to:
 * - Members of the diagram's community
 * - Admins
 */
export default function EditButton({ community }: EditButtonProps) {
  const navigate = useNavigate();
  const { diagramName } = useParams<{ diagramName: string }>();
  const { user } = useUserStore();

  // Check if user can edit this diagram
  const canEdit = user && (user.IsAdmin || user.Community === community);

  // Don't render if user can't edit
  if (!canEdit || !community || !diagramName) {
    return null;
  }

  const handleEdit = () => {
    navigate(
      `/editor/${encodeURIComponent(community)}/${encodeURIComponent(diagramName)}`,
    );
  };

  return (
    <button
      onClick={handleEdit}
      className="group px-3 py-2.5 bg-white text-black rounded-full font-[12px] border border-gray-300 cursor-pointer shadow-sm hover:bg-black hover:text-white hover:border-black hover:px-3 hover:pl-5 hover:py-2.5 hover:pr-5.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap flex items-center gap-1"
      title="Edit this diagram"
    >
      <Pen className="w-4 h-auto" />
      <span className="inline-block max-w-0 group-hover:max-w-xs group-hover:ml-2 transition-all duration-400 ease-in-out overflow-hidden ">
        Edit Learning Path
      </span>
    </button>
  );
}

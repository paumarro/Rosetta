import { Handle, Position } from '@xyflow/react';
import { TopicNodeProps } from '@/types/reactflow';
import { useNodeState } from '@/lib/hooks/useNodeState';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useHandleVisibility, getNodeWidthClass } from '@/lib/connectionUtils';
import { useMemo } from 'react';

// Handle configuration type
type HandleConfig = {
  id: 't' | 'r' | 'b' | 'l';
  position: Position;
};

// All possible handle positions
const ALL_HANDLES: HandleConfig[] = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
];

// Subtopic handle configurations based on side
const SUBTOPIC_HANDLES: Record<number, HandleConfig[]> = {
  1: [{ id: 'l', position: Position.Left }], // Right side - left handle only
  2: [{ id: 'r', position: Position.Right }], // Left side - right handle only
  0: [
    // Default - both left and right
    { id: 'l', position: Position.Left },
    { id: 'r', position: Position.Right },
  ],
};

/**
 * Renders both source and target handles for a given position.
 * This enables bidirectional connections.
 */
const BidirectionalHandle = ({
  id,
  position,
  isVisible,
}: {
  id: string;
  position: Position;
  isVisible: boolean;
}) => (
  <>
    <Handle
      type="source"
      position={position}
      id={id}
      style={{ opacity: isVisible ? 1 : 0 }}
    />
    <Handle
      type="target"
      position={position}
      id={id}
      style={{ opacity: isVisible ? 1 : 0 }}
    />
  </>
);

const TopicNode = ({
  id,
  data,
  selected,
  type,
  ...nodeProps
}: TopicNodeProps) => {
  const { connectedUsers, isViewMode } = useCollaborativeStore();
  const { isBeingEdited, editedBy } = useNodeState(id);

  // Find the user who is editing this node
  const editingUser = connectedUsers.find((user) => user.userName === editedBy);

  // Use centralized hook to determine which handles should be visible
  const isHandleValid = useHandleVisibility(
    id,
    type,
    {
      x: nodeProps.positionAbsoluteX || 0,
      y: nodeProps.positionAbsoluteY || 0,
    },
    data,
  );

  // Style based on the ReactFlow type and editing status
  const getNodeStyles = () => {
    //Check if node is being edited - override all other styles
    if (isBeingEdited) {
      return {
        base: 'bg-white',
        border: 'border-black border-[2.5px] rounded-[5px]',
        hover: 'hover:bg-white',
        height: type === 'subtopic' ? 'h-[38px]' : 'h-[52px]',
        text: {
          color: 'text-black',
          size: 'text-sm',
        },
      };
    }

    if (type === 'subtopic') {
      return {
        base: selected ? 'bg-sub-hover' : 'bg-sub-bg',
        border: 'border-sub-border border-[2.5px] rounded-[5px]',
        hover: 'hover:bg-sub-hover',
        height: 'h-[38px]',
        text: {
          color: 'text-white',
          size: 'text-sm',
        },
      };
    } else {
      // topic (including the starting nodes)
      return {
        base: selected ? 'bg-topic-hover' : 'bg-topic-bg',
        border: 'border-topic-border border-[2.5px] rounded-[5px]',
        hover: 'hover:bg-topic-hover',
        height: 'h-[52px]',
        text: {
          color: 'text-white',
          size: 'text-sm',
        },
      };
    }
  };

  // Get dynamic width class from centralized utility
  const widthClass = getNodeWidthClass(data.label);

  const handleNodeClick = () => {
    const event = new CustomEvent('openNodeModal', {
      detail: { id, data },
    });
    // console.log('📡 Dispatching event:', event.detail);
    window.dispatchEvent(event);
  };

  // Truncate text to max 16 characters
  const getTruncatedLabel = () => {
    const maxLength = 16;
    if (data.label.length <= maxLength) {
      return data.label;
    }
    return data.label.substring(0, maxLength - 3) + '...'; // -3 for the ellipsis
  };

  // Determine which handles to render based on node type
  const activeHandles = useMemo(() => {
    if (type === 'subtopic') {
      const side = (data.side as number) || 0;
      return SUBTOPIC_HANDLES[side] ?? SUBTOPIC_HANDLES[0];
    }
    // Topic nodes have all 4 handles
    return ALL_HANDLES;
  }, [type, data.side]);

  const styles = getNodeStyles();
  const displayLabel = getTruncatedLabel();

  return (
    <div
      className={`px-4 shadow-md transition-colors cursor-pointer flex items-center justify-center
        ${styles.base} ${styles.border} ${styles.hover} ${widthClass} ${styles.height}`}
      data-view-mode={isViewMode}
      onClick={handleNodeClick}
    >
      {/* Render bidirectional handles based on node type */}
      {activeHandles.map((handle) => (
        <BidirectionalHandle
          key={handle.id}
          id={handle.id}
          position={handle.position}
          isVisible={isHandleValid[handle.id]}
        />
      ))}

      <div className={`text-center`}>
        <div className={`${styles.text.color} ${styles.text.size}`}>
          {displayLabel}
        </div>
      </div>
      {/* Editing indicator */}
      {isBeingEdited && editingUser && (
        <div className="absolute -right-3.5 top-1/2 -translate-y-1/2">
          <Avatar
            className="w-6 h-6"
            isActive={true}
            userColor={editingUser.color}
          >
            <AvatarFallback
              className="text-xs text-white"
              userColor={editingUser.color}
            >
              {editingUser.userName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
};

export default TopicNode;

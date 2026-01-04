import { Handle, Position } from '@xyflow/react';
import { TopicNodeProps } from '@/types/reactflow';
import {
  useCollaborativeStore,
  useNodeState,
} from '@/store/collaborationStore';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  useHandleVisibility,
  getNodeWidthClass,
  getNodeHeightClass,
  getNodeCenter,
  NODE_DIMENSIONS,
} from '@/utils/nodeConnection';
import { getNodeCompletion } from '@/utils/storage';
import { useMemo, useState, useEffect, useRef, memo } from 'react';

// Handle configuration type
type HandleConfig = {
  id: 't' | 'r' | 'b' | 'l';
  position: Position;
};

// All possible handle positions for topic nodes
const ALL_HANDLES: HandleConfig[] = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left },
];

/** Renders bidirectional source and target handles for ReactFlow node connections */
const BidirectionalHandle = ({
  id,
  position,
  isVisible,
}: {
  id: string;
  position: Position;
  isVisible: boolean;
}): React.ReactElement => (
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

/** Custom ReactFlow node for topics and subtopics with editing state, completion tracking, and connection handles */
const TopicNode = ({
  id,
  data,
  selected,
  type,
  ...nodeProps
}: TopicNodeProps): React.ReactElement => {
  // Use granular selectors to minimize re-renders
  const connectedUsers = useCollaborativeStore((state) => state.connectedUsers);
  const isViewMode = useCollaborativeStore((state) => state.isViewMode);
  const nodes = useCollaborativeStore((state) => state.nodes);
  const edges = useCollaborativeStore((state) => state.edges);
  const openNodeModal = useCollaborativeStore((state) => state.openNodeModal);
  const modalNodeId = useCollaborativeStore((state) => state.modalNodeId);
  const learningPathId = useCollaborativeStore((state) => state.learningPathId);
  const shakeNodeId = useCollaborativeStore((state) => state.shakeNodeId);
  const clearShakeNode = useCollaborativeStore((state) => state.clearShakeNode);
  const { isBeingEdited, editedBy } = useNodeState(id);

  // Defensive check: ensure label exists (can be undefined during initial sync)
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const label = (data?.label as string | undefined) ?? '';

  // Track completion state (scoped to diagram + node)
  const [isCompleted, setIsCompleted] = useState(() => {
    return getNodeCompletion(learningPathId, id);
  });

  // Track shake animation state
  const [isShaking, setIsShaking] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Re-read completion state when modal closes (user may have toggled completion)
  useEffect(() => {
    setIsCompleted(getNodeCompletion(learningPathId, id));
  }, [modalNodeId, learningPathId, id]);

  // Trigger shake animation when this node is targeted for shake
  useEffect(() => {
    if (shakeNodeId === id) {
      setIsShaking(true);
      // Clear shake after animation completes
      const timer = setTimeout(() => {
        setIsShaking(false);
        clearShakeNode();
      }, 500);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [shakeNodeId, id, clearShakeNode]);

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
    edges,
  );

  // Style based on the ReactFlow type and editing status
  const getNodeStyles = () => {
    // Get height class from centralized utility
    const heightClass = getNodeHeightClass(label, type);

    //Check if node is being edited - override all other styles
    // In view mode, don't show the white editing effect
    if ((isBeingEdited && !isViewMode) || (isCompleted && isViewMode)) {
      return {
        base: 'bg-white',
        border: 'border-gray border-[1px] rounded-[5px]',
        hover: 'hover:bg-white',
        height: heightClass,
        text: {
          color: '!text-gray-300',
          size: 'text-sm',
        },
      };
    }

    if (type === 'subtopic') {
      return {
        base: selected ? 'bg-gray-300' : 'bg-white',
        border: 'border-gray-200 border-[1px] rounded-[5px]',
        hover: 'hover:bg-gray-200',
        height: heightClass,
        text: {
          color: 'text-black',
          size: 'text-sm',
        },
      };
    } else {
      // topic (including the starting nodes)
      return {
        base: selected ? 'bg-topic-hover' : 'bg-gray-900',
        border: 'border-topic-border border-[1px] rounded-[5px]',
        hover: 'hover:bg-gray-700',
        height: heightClass,
        text: {
          color: 'text-white',
          size: 'text-sm',
        },
      };
    }
  };

  // Get dynamic width class from centralized utility
  const widthClass = getNodeWidthClass(label);

  const handleNodeClick = () => {
    openNodeModal(id);
  };

  // Split label into two lines if length > LABEL_THRESHOLD
  const splitLabelForDisplay = () => {
    const maxLength = NODE_DIMENSIONS.LABEL_MAX_LENGTH;
    const threshold = NODE_DIMENSIONS.LABEL_THRESHOLD;

    if (label.length <= threshold) {
      // Short labels stay on one line
      return { firstLine: label, secondLine: null };
    }

    // Find smart break point: look for last space within reasonable range
    const searchStart = Math.max(0, threshold - 4); // Search from position 12-16
    const searchEnd = Math.min(label.length, threshold);
    let breakPoint = -1;

    // Look for last space in the search range
    for (let i = searchEnd - 1; i >= searchStart; i--) {
      if (label[i] === ' ') {
        breakPoint = i;
        break;
      }
    }

    // Determine first and second line based on break point
    let firstLine: string;
    let secondLine: string;

    if (breakPoint !== -1) {
      // Break at space (don't include the space)
      firstLine = label.substring(0, breakPoint);
      secondLine = label.substring(breakPoint + 1);
    } else {
      // No space found - break mid-word with hyphen
      firstLine = label.substring(0, threshold - 1) + '-';
      secondLine = label.substring(threshold - 1);
    }

    // Handle truncation if total length exceeds maxLength
    if (label.length > maxLength) {
      const remainingLength = maxLength - firstLine.length;
      if (secondLine.length > remainingLength) {
        secondLine = secondLine.substring(0, remainingLength - 3) + '...';
      }
    }

    return { firstLine, secondLine };
  };

  // Determine which handles to render based on node type and nearest topic node
  const activeHandles = useMemo(() => {
    // Topic nodes always have all 4 handles
    if (type === 'topic') {
      return ALL_HANDLES;
    }

    // For subtopic nodes, determine handles based on nearest topic node
    const currentPosition = {
      x: nodeProps.positionAbsoluteX || 0,
      y: nodeProps.positionAbsoluteY || 0,
    };
    const currentCenter = getNodeCenter(currentPosition, label, type);

    // Find all topic nodes
    const topicNodes = nodes.filter((n) => n.type === 'topic');

    if (topicNodes.length === 0) {
      // No topic nodes - show both left and right handles
      return [
        { id: 'l' as const, position: Position.Left },
        { id: 'r' as const, position: Position.Right },
      ] as HandleConfig[];
    }

    // Find nearest topic node
    let nearestTopic = topicNodes[0];
    let minDistance = Infinity;

    topicNodes.forEach((topicNode) => {
      const topicCenter = getNodeCenter(
        topicNode.position,
        topicNode.data.label,
        topicNode.type || 'topic',
      );
      const distance = Math.sqrt(
        Math.pow(topicCenter.x - currentCenter.x, 2) +
          Math.pow(topicCenter.y - currentCenter.y, 2),
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestTopic = topicNode;
      }
    });

    // Calculate direction to nearest topic node
    const nearestCenter = getNodeCenter(
      nearestTopic.position,
      nearestTopic.data.label,
      nearestTopic.type || 'topic',
    );
    const dx = nearestCenter.x - currentCenter.x;

    // Determine which side faces the nearest topic node
    // If topic is to the right (positive dx), show right handle
    // If topic is to the left (negative dx), show left handle
    if (dx > 0) {
      // Topic is to the right - show right handle
      return [{ id: 'r' as const, position: Position.Right }] as HandleConfig[];
    } else {
      // Topic is to the left - show left handle
      return [{ id: 'l' as const, position: Position.Left }] as HandleConfig[];
    }
  }, [
    type,
    nodeProps.positionAbsoluteX,
    nodeProps.positionAbsoluteY,
    label,
    nodes,
  ]);

  const styles = getNodeStyles();
  const { firstLine, secondLine } = splitLabelForDisplay();

  return (
    <div
      ref={nodeRef}
      className={`px-4 transition-colors cursor-pointer flex items-center justify-center
        ${styles.base} ${styles.border} ${styles.hover} ${widthClass} ${styles.height}
        ${isShaking ? 'node-shake' : ''}`}
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

      <div className={`text-center flex flex-col justify-center`}>
        <div className={`${styles.text.color} ${styles.text.size}`}>
          {firstLine}
        </div>
        {secondLine && (
          <div className={`${styles.text.color} ${styles.text.size}`}>
            {secondLine}
          </div>
        )}
      </div>
      {/* Editing indicator - hidden in view mode */}
      {isBeingEdited && editingUser && !isViewMode && (
        <div className="absolute -right-3.5 top-1/2 -translate-y-1/2">
          <UserAvatar
            userName={editingUser.userName}
            photoURL={editingUser.photoURL}
            color={editingUser.color ?? '#000000'}
            className="w-8 h-8"
            fallbackClassName="text-xs text-white"
          />
        </div>
      )}
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
// Only re-render when critical props change
export default memo(TopicNode, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  // Return false if props differ (trigger re-render)
  return (
    prevProps.id === nextProps.id &&
    prevProps.data === nextProps.data &&
    prevProps.selected === nextProps.selected &&
    prevProps.type === nextProps.type &&
    prevProps.positionAbsoluteX === nextProps.positionAbsoluteX &&
    prevProps.positionAbsoluteY === nextProps.positionAbsoluteY
  );
});

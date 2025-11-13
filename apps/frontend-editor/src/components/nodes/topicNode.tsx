import { Handle, Position } from '@xyflow/react';
import { TopicNodeProps } from '@/types/reactflow';
import { useNodeState } from '@/lib/hooks/useNodeState';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  useHandleVisibility,
  getNodeWidthClass,
  getNodeHeightClass,
  NODE_DIMENSIONS,
} from '@/lib/connectionUtils';
import { useMemo } from 'react';

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
  const { connectedUsers, isViewMode, nodes, edges } = useCollaborativeStore();
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
    edges,
  );

  // Style based on the ReactFlow type and editing status
  const getNodeStyles = () => {
    // Get height class from centralized utility
    const heightClass = getNodeHeightClass(data.label, type);

    //Check if node is being edited - override all other styles
    // In view mode, don't show the white editing effect
    if (isBeingEdited && !isViewMode) {
      return {
        base: 'bg-white',
        border: 'border-black border-[2.5px] rounded-[5px]',
        hover: 'hover:bg-white',
        height: heightClass,
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
        height: heightClass,
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
        height: heightClass,
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

  // Split label into two lines if length > LABEL_THRESHOLD
  const splitLabelForDisplay = () => {
    const label = data.label;
    const maxLength = 30;
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
    // Helper to calculate node dimensions using centralized constants
    const getLocalNodeDimensions = (label: string, nodeType: string) => {
      const labelLength = label.length || 0;

      // Use 75px height for labels > LABEL_THRESHOLD, otherwise type-specific base height
      const baseHeight =
        nodeType === 'subtopic'
          ? NODE_DIMENSIONS.BASE_HEIGHT.SUBTOPIC
          : NODE_DIMENSIONS.BASE_HEIGHT.TOPIC;
      const height =
        labelLength > NODE_DIMENSIONS.LABEL_THRESHOLD
          ? NODE_DIMENSIONS.TWO_LINE_HEIGHT
          : baseHeight;

      let width: number;
      if (labelLength <= NODE_DIMENSIONS.WIDTH_BREAKPOINTS.SMALL) {
        width = NODE_DIMENSIONS.WIDTH_VALUES.SMALL;
      } else if (labelLength <= NODE_DIMENSIONS.WIDTH_BREAKPOINTS.MEDIUM) {
        width = NODE_DIMENSIONS.WIDTH_VALUES.MEDIUM;
      } else {
        width = NODE_DIMENSIONS.WIDTH_VALUES.LARGE;
      }
      return { width, height };
    };

    // Helper to calculate node center position
    const getLocalNodeCenter = (
      position: { x: number; y: number },
      label: string,
      nodeType: string,
    ) => {
      const { width, height } = getLocalNodeDimensions(label, nodeType);
      return {
        x: position.x + width / 2,
        y: position.y + height / 2,
      };
    };

    // Topic nodes always have all 4 handles
    if (type === 'topic') {
      return ALL_HANDLES;
    }

    // For subtopic nodes, determine handles based on nearest topic node
    const currentPosition = {
      x: nodeProps.positionAbsoluteX || 0,
      y: nodeProps.positionAbsoluteY || 0,
    };
    const currentCenter = getLocalNodeCenter(currentPosition, data.label, type);

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
      const topicCenter = getLocalNodeCenter(
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
    const nearestCenter = getLocalNodeCenter(
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
    data.label,
    nodes,
  ]);

  const styles = getNodeStyles();
  const { firstLine, secondLine } = splitLabelForDisplay();

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
          <Avatar className="w-7 h-7" userColor={editingUser.color}>
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

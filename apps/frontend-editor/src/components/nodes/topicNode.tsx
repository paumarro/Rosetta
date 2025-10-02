import { Handle, Position } from '@xyflow/react';

interface Resource {
  title: string;
  type: 'article' | 'video';
  url: string;
}

interface TopicNodeData {
  label: string;
  side: 0 | 1 | 2 | 3; // 0 for center, 1 for right, 2 for left, 3 for no specific side
  parentId?: string | null;
  description?: string;
  resources?: Resource[];
}

interface TopicNodeProps {
  id: string;
  data: TopicNodeData;
  selected: boolean;
  type: string; // ReactFlow type: "topic" or "subtopic"
}

const TopicNode = ({ data, selected, type, id }: TopicNodeProps) => {
  // Style based on the ReactFlow type
  const getNodeStyles = () => {
    if (type === 'subtopic') {
      return {
        base: selected ? 'bg-sub-hover' : 'bg-sub-bg bg-red-800',
        border: 'border-sub-border border-[2.5px] rounded-[5px]',
        hover: 'hover:bg-sub-hover',
        text: 'text-white',
        size: 'text-sm',
      };
    } else {
      // topic (including the starting nodes)
      return {
        base: selected ? 'bg-topic-hover' : 'bg-topic-bg',
        border: 'border-topic-border border-[2.5px] rounded-[5px]',
        hover: 'hover:bg-topic-hover',
        text: 'text-white',
        size: 'text-sm',
      };
    }
  };

  // Dynamic width based on text length
  const getNodeWidth = () => {
    const textLength = data.label.length;
    if (textLength <= 5) {
      return 'w-[72px]';
    } else if (textLength <= 8) {
      return 'w-[102px]';
    } else {
      return 'w-[170px]'; // Control max length to be 16 including spaces to avoid overly wide nodes
    }
  };

  const handleNodeClick = () => {
    // Dispatch custom event to open modal
    const event = new CustomEvent('openNodeModal', {
      detail: { nodeId: id, data },
    });
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

  const renderHandles = () => {
    // SUBTOPIC NODES - Different logic based on side
    if (type === 'subtopic') {
      if (data.side === 1) {
        // Subtopic on right side
        return (
          <>
            <Handle type="target" position={Position.Left} id="l" />
          </>
        );
      } else if (data.side === 2) {
        // Subtopic on left side
        return (
          <>
            <Handle type="target" position={Position.Right} id="r" />
          </>
        );
      } else {
        // Default subtopic handles (side 3 or other)
        return (
          <>
            <Handle type="target" position={Position.Left} id="l" />
            <Handle type="target" position={Position.Right} id="r" />
          </>
        );
      }
    }

    // TOPIC NODES - Original logic
    if (data.side === 0) {
      // Starting node: only right and bottom handles
      return (
        <>
          <Handle type="source" position={Position.Right} id="r" />
          <Handle type="source" position={Position.Bottom} id="b" />
        </>
      );
    } else if (data.side === 1) {
      // Right side topic
      return (
        <>
          <Handle type="target" position={Position.Top} id="t" />
          <Handle type="source" position={Position.Right} id="r" />
          <Handle type="source" position={Position.Bottom} id="b" />
        </>
      );
    } else if (data.side === 2) {
      // Left side topic
      return (
        <>
          <Handle type="target" position={Position.Top} id="t" />
          <Handle type="source" position={Position.Left} id="l" />
          <Handle type="source" position={Position.Bottom} id="b" />
        </>
      );
    } else {
      // Default topic handles (side 3)
      return (
        <>
          <Handle type="target" position={Position.Top} id="t" />
          <Handle type="target" position={Position.Left} id="l" />
          <Handle type="source" position={Position.Right} id="r" />
          <Handle type="source" position={Position.Bottom} id="b" />
        </>
      );
    }
  };

  const styles = getNodeStyles();
  const widthClass = getNodeWidth();
  const displayLabel = getTruncatedLabel();

  return (
    <div
      className={`px-4 py-2 shadow-md transition-colors cursor-pointer 
        ${styles.base} ${styles.border} ${styles.hover} ${widthClass}`}
      onClick={handleNodeClick}
    >
      {renderHandles()}

      <div className={` text-center`}>
        <div className={`${styles.text} ${styles.size}`}>{displayLabel}</div>
      </div>
    </div>
  );
};

export default TopicNode;

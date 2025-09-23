import { Handle, Position } from '@xyflow/react';

interface Resource {
  title: string;
  type: 'article' | 'video';
  url: string;
}

interface TopicNodeData {
  label: string;
  level?: number;
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
        base: selected ? 'bg-sub-hover' : 'bg-sub-bg',
        border: 'border-sub-border',
        hover: 'hover:bg-sub-hover',
        text: 'text-white',
        size: 'text-sm',
      };
    } else {
      // topic (including the starting nodes)
      return {
        base: selected ? 'bg-gray-900' : 'bg-black',
        border: 'border-gray-700',
        hover: 'hover:bg-gray-900',
        text: 'text-white',
        size: 'text-lg',
      };
    }
  };

  const handleNodeClick = () => {
    // Dispatch custom event to open modal
    const event = new CustomEvent('openNodeModal', {
      detail: { nodeId: id, data },
    });
    window.dispatchEvent(event);
  };

  const styles = getNodeStyles();
  const isStartingNode = data.level === 0;

  return (
    <div
      className={`px-4 py-2 shadow-md rounded-md border-2 transition-colors cursor-pointer
        ${styles.base} ${styles.border} ${styles.hover}`}
      onClick={handleNodeClick}
    >
      {/* Input Handles - starting nodes don't need input handles */}
      {!isStartingNode && (
        <>
          <Handle type="target" position={Position.Top} id="t" />
          <Handle type="target" position={Position.Left} id="l" />
        </>
      )}

      <div className="flex">
        <div className="ml-2">
          <div className={`${styles.text} ${styles.size} font-bold`}>
            {data.label}
          </div>
        </div>
      </div>

      {/* Output Handles - all nodes can have outputs */}
      <Handle type="source" position={Position.Right} id="r" />
      <Handle type="source" position={Position.Bottom} id="b" />
    </div>
  );
};

export default TopicNode;

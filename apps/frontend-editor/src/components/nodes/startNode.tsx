import { Handle, Position } from '@xyflow/react';

interface StartNodeData {
  label: string;
}
const StartNode = ({
  data,
  selected,
}: {
  data: StartNodeData;
  selected: boolean;
}) => (
  <div
    className={`px-4 py-2 shadow-md rounded-md border-2  border-topic-border hover:bg-topic-hover 
      ${selected ? 'bg-topic-hover' : 'bg-topic-bg'}`}
  >
    {/* <Handle type="target" position={Position.Top} id="t" /> */}
    {/* <Handle type="target" position={Position.Left} id="l" /> */}
    <div className="flex">
      <div className="ml-2">
        <div className="text-sm text-white">{data.label}</div>
      </div>
    </div>
    <Handle type="source" position={Position.Right} id="r" />
    <Handle type="source" position={Position.Bottom} id="b" />
  </div>
);

export default StartNode;

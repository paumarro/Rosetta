import { Handle, Position } from '@xyflow/react';

interface CustomNodeData {
  label: string;
}

const CustomNode = ({
  data,
  selected,
}: {
  data: CustomNodeData;
  selected: boolean;
}) => (
  <div
    className={`px-4 py-2 shadow-md rounded-md border-2 
       ${selected ? 'bg-gray-900' : 'bg-black'}`}
  >
    <Handle type="target" position={Position.Top} id="t" />
    <Handle type="target" position={Position.Left} id="l" />
    <div className="flex">
      <div className="ml-2">
        <div className="text-lg text-white font-bold">{data.label}</div>
      </div>
    </div>
    <Handle type="source" position={Position.Right} id="r" />
    <Handle type="source" position={Position.Bottom} id="b" />
  </div>
);

export default CustomNode;

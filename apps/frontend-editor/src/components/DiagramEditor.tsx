import { useEffect, useState, useRef, useCallback } from 'react';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import {
  ReactFlow,
  Background,
  Controls,
  NodeTypes,
  Panel,
  BackgroundVariant,
  ViewportPortal,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AddNodeButton from '@/components/ui/addNodeButton';
import AvatarDemo from '@/components/ui/AvatarDemo';
import TopicNode from './nodes/topicNode';
import { LoadingOverlay } from './ui/loading-overlay';
import { NodeModal } from './NodeModal';

const nodeTypes: NodeTypes = {
  topic: TopicNode,
  subtopic: TopicNode,
};

interface DiagramEditorProps {
  diagramName?: string;
}

export default function DiagramEditor({
  diagramName = 'default',
}: DiagramEditorProps) {
  const {
    initializeCollaboration,
    isInitializing,
    cleanup,
    isConnected: storeIsConnected,
    nodes: storeNodes,
    edges: storeEdges,
    title,
    onNodeChange,
    onEdgeChange,
    onConnect,
  } = useCollaborativeStore();

  const [currentUser] = useState({
    userId: Math.random().toString(36).substring(2, 9),
    userName: `${Math.random().toString(36).substring(2, 4)}-User`,
  });

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Initialize collaboration when component mounts or diagram changes
  useEffect(() => {
    void initializeCollaboration(diagramName, currentUser);
  }, [diagramName, currentUser, initializeCollaboration]);
  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - calling cleanup');
      cleanup();
    };
  }, []);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const modalEvent = new CustomEvent('openNodeModal', {
      detail: {
        id: node.id,
        data: {
          label: node.data.label,
          description: node.data.description,
          resources: node.data.resources,
        },
      },
    });
    window.dispatchEvent(modalEvent);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedEdges = storeEdges.filter((edge) => edge.selected);
        if (selectedEdges.length > 0) {
          event.preventDefault();
          onEdgeChange(
            selectedEdges.map((edge) => ({
              id: edge.id,
              type: 'remove' as const,
            })),
          );
        }
      }
    },
    [storeEdges, onEdgeChange],
  );

  if (isInitializing) {
    return <LoadingOverlay message="Loading diagram" />;
  }

  const fitViewOptions = {
    padding: 0.2,
    duration: 800,
  };

  const defaultEdgeOptions = {
    selectable: true,
    deletable: true,
  };

  const getTitlePosition = () => {
    if (storeNodes.length === 0) return { x: 0, y: 0 };
    const minY = Math.min(...storeNodes.map((node) => node.position.y));
    const safeMinY = isFinite(minY) ? minY : 0;
    const titleWidth = title.length * 18.6;
    return { x: -titleWidth / 2, y: safeMinY - 100 };
  };

  return (
    <div
      className="h-screen w-full flex flex-col bg-gray-50"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={storeNodes}
          edges={storeEdges}
          onNodesChange={onNodeChange}
          onEdgesChange={onEdgeChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView={true}
          fitViewOptions={fitViewOptions}
          minZoom={0.8}
          maxZoom={1}
          attributionPosition="top-right"
          defaultEdgeOptions={defaultEdgeOptions}
          elementsSelectable={true}
          edgesFocusable={true}
          edgesReconnectable={false}
        >
          <Controls />
          <Background variant={'dots' as BackgroundVariant} gap={12} size={1} />
          <Panel position="top-left">
            <div className="bg-white p-3 rounded-lg shadow-md border">
              <p className="text-sm text-gray-600 mt-1">
                {storeIsConnected ? (
                  <span className="text-green-600">
                    ● Connected as {currentUser.userName}
                  </span>
                ) : (
                  <span className="text-red-600">● Disconnected</span>
                )}
              </p>
              <p className="text-sm text-gray-600">Diagram: {diagramName}</p>
            </div>
            <AvatarDemo />
          </Panel>
          <Panel position="center-left">
            <AddNodeButton />
          </Panel>
          <ViewportPortal>
            <div
              className="absolute pointer-events-none select-none"
              style={{
                left: getTitlePosition().x,
                top: getTitlePosition().y,
              }}
            >
              <h1 className="text-5xl font-bold">{title}</h1>
            </div>
          </ViewportPortal>
        </ReactFlow>
      </div>
      <NodeModal />
    </div>
  );
}

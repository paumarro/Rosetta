import { useEffect, useState, useRef } from 'react';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import {
  ReactFlow,
  Background,
  Controls,
  NodeTypes,
  Panel,
  BackgroundVariant,
  ViewportPortal,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from './ui/button';
import { Circle, Diamond, Play } from 'lucide-react';
import CustomNode from './nodes/customNode';
import StartNode from './nodes/startNode';
import { LoadingOverlay } from './ui/loading-overlay';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
  start: StartNode,
};

interface DiagramEditorProps {
  diagramName?: string;
}

export default function DiagramEditor({
  diagramName = 'default',
}: DiagramEditorProps) {
  // Test the collaborative store
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
    addNode,
  } = useCollaborativeStore();

  const [currentUser] = useState({
    userId: Math.random().toString(36).substring(2, 9),
    userName: `User-${Math.random().toString(36).substring(2, 4)}`,
  });

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // const [reactFlowInstance, setReactFlowInstance] =
  //   useState<ReactFlowInstance | null>(null);

  // Initialization of collaborative store
  useEffect(() => {
    const initializeCollaborativeStore = async () => {
      console.log('[Diagram Editor] Initializing collaborative store...');
      await initializeCollaboration(diagramName, currentUser);
      console.log('[Diagram Editor] Initialization complete');
    };

    void initializeCollaborativeStore();
    return () => {
      console.log('[Diagram Editor] Cleaning up collaborative store...');
      cleanup();
    };
  }, [diagramName, currentUser, initializeCollaboration, cleanup]);

  // const onDragOver = useCallback((event: React.DragEvent) => {
  //   event.preventDefault();
  //   event.dataTransfer.dropEffect = 'move';
  // }, []);

  // Show loading overlay when loading or reconnecting
  if (isInitializing) {
    return <LoadingOverlay message="Loading diagram" />;
  }

  const fitViewOptions = {
    padding: 0.2,
    duration: 800,
  };

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* React Flow Editor */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={storeNodes}
          edges={storeEdges}
          onNodesChange={onNodeChange}
          onEdgesChange={onEdgeChange}
          onConnect={onConnect}
          // onInit={setReactFlowInstance}
          // onDrop={onDrop}
          // onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView={true}
          fitViewOptions={fitViewOptions}
          minZoom={0.8}
          maxZoom={1}
          attributionPosition="top-right"
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background variant={'dots' as BackgroundVariant} gap={12} size={1} />
          {/* Status Panel */}
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
          </Panel>
          {/* Toolbar */}
          <Panel position="top-right">
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  addNode('Start');
                }}
              >
                <Play className="w-4 h-4" />
                Start
              </Button>

              <Button
                onClick={() => {
                  addNode('Topic');
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Circle className="w-4 h-4" />
                Topic
              </Button>
              <Button
                onClick={() => {
                  addNode('Sub Topic');
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Diamond className="w-4 h-4" />
                Sub Topic
              </Button>
            </div>
          </Panel>
          <ViewportPortal>
            <div className="text-5xl font-bold">Diagram Title: {title}</div>
          </ViewportPortal>
        </ReactFlow>
      </div>
    </div>
  );
}

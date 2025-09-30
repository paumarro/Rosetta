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
import { Button } from './ui/button';
import { Circle, Diamond } from 'lucide-react';
import TopicNode from './nodes/topicNode';
import { LoadingOverlay } from './ui/loading-overlay';
import { NodeModal } from './NodeModal';

const nodeTypes: NodeTypes = {
  topic: TopicNode,
  subtopic: TopicNode, // <- This maps to the "type" field
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

  // Add this click handler
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node); // For debugging

    // Dispatch the event that NodeModal is listening for
    const modalEvent = new CustomEvent('openNodeModal', {
      detail: {
        nodeId: node.id,
        data: {
          label: node.data.label,
          description: node.data.description,
          resources: node.data.resources,
        },
      },
    });

    window.dispatchEvent(modalEvent);
  }, []);

  // Show loading overlay when loading or reconnecting
  if (isInitializing) {
    return <LoadingOverlay message="Loading diagram" />;
  }

  const fitViewOptions = {
    padding: 0.2,
    duration: 800,
  };

  //Calculate title position based on nodes
  const getTitlePosition = () => {
    if (storeNodes.length === 0) {
      return { x: 0, y: 0 }; // Default position if no nodes
    }
    const centerX = 0;
    const minY = Math.min(...storeNodes.map((node) => node.position.y));
    const titleWidth = title.length * 18.6; // Approximate width based on character count
    const safeMinY = isFinite(minY) ? minY : 0;
    return { x: centerX - titleWidth / 2, y: safeMinY - 100 };
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
          onNodeClick={onNodeClick}
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
                  addNode('subtopic');
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

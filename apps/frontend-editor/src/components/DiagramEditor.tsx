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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Circle, Diamond } from 'lucide-react';
import TopicNode from './nodes/topicNode';
import { LoadingOverlay } from './ui/loading-overlay';
import { NodeModal } from './NodeModal';

const nodeTypes: NodeTypes = {
  topic: TopicNode,
  subtopic: TopicNode,
  custom: TopicNode, // <- Fallback for custom type nodes
};

interface DiagramEditorProps {
  diagramName?: string;
}

function AvatarDemo() {
  const authors = [
    {
      src: 'https://github.com/shadcn.png',
      alt: '@shadcn',
      fallback: 'CN',
      isActive: true,
    },
    {
      src: 'https://github.com/maxleiter.png',
      alt: '@maxleiter',
      fallback: 'LR',
      isActive: true,
    },
    {
      src: 'https://github.com/evilrabbit.png',
      alt: '@evilrabbit',
      fallback: 'ER',
      isActive: true,
    },
    {
      src: 'https://github.com/vercel.png',
      alt: '@vercel',
      fallback: 'VR',
      isActive: false,
    },
    {
      src: 'https://github.com/nextjs.png',
      alt: '@nextjs',
      fallback: 'NJ',
      isActive: false,
    },
    {
      src: 'https://github.com/react.png',
      alt: '@react',
      fallback: 'RC',
      isActive: true,
    },
  ];
  const maxVisible = 4;
  const visibleAuthors = authors.slice(0, maxVisible);
  const remainingCount = authors.length - maxVisible;

  return (
    <div className="mt-3">
      <h3 className="text-lg font-semibold mb-3">Authors</h3>
      <div className="flex -space-x-1 items-center">
        {visibleAuthors.map((author, index) => (
          <div key={index}>
            <Avatar className="w-9 h-9" isActive={author.isActive}>
              <AvatarImage src={author.src} alt={author.alt} />
              <AvatarFallback className="text-sm">
                {author.fallback}
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
        {remainingCount > 0 && (
          <Avatar className="w-9 h-9" isActive={false}>
            <AvatarFallback className="text-sm  ">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
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
    addNode,
  } = useCollaborativeStore();

  const [currentUser] = useState({
    userId: Math.random().toString(36).substring(2, 9),
    userName: `User-${Math.random().toString(36).substring(2, 4)}`,
  });

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void initializeCollaboration(diagramName, currentUser);
    return () => {
      cleanup();
    };
  }, [diagramName, currentUser, initializeCollaboration, cleanup]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
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

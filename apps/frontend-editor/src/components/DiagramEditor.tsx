import { useEffect, useState, useRef, useCallback } from 'react';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import {
  ReactFlow,
  Background,
  NodeTypes,
  Panel,
  BackgroundVariant,
  ViewportPortal,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AddNodeButton from '@/components/ui/addNodeButton';
import AvatarDemo from '@/components/ui/AvatarDemo';
import Cursors from '@/components/ui/Cursors';
import TopicNode from './nodes/topicNode';
import { LoadingOverlay } from './ui/loading-overlay';
import { NodeModal } from './NodeModal';

const nodeTypes: NodeTypes = {
  topic: TopicNode,
  subtopic: TopicNode,
};

interface DiagramEditorProps {
  diagramName?: string;
  mode?: 'edit' | 'view';
}

export default function DiagramEditor({
  diagramName = 'default',
  mode = 'edit',
}: DiagramEditorProps) {
  const {
    initializeCollaboration,
    isInitializing,
    cleanup,
    nodes: storeNodes,
    edges: storeEdges,
    title,
    onNodeChange,
    onEdgeChange,
    onConnect,
    updateCursor,
  } = useCollaborativeStore();

  const [currentUser] = useState({
    userId: Math.random().toString(36).substring(2, 9),
    userName: `${Math.random().toString(36).substring(2, 4)}-User`,
  });

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastCursorUpdate = useRef<number>(0);

  const isViewMode = mode === 'view';

  // Initialize collaboration when component mounts or diagram changes
  useEffect(() => {
    void initializeCollaboration(diagramName, currentUser, isViewMode);
  }, [diagramName, currentUser, initializeCollaboration, isViewMode]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - calling cleanup');
      cleanup();
    };
  }, [cleanup]);

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
      // Disable deletion in view mode
      if (isViewMode) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = storeNodes.filter((node) => node.selected);
        const selectedEdges = storeEdges.filter((edge) => edge.selected);

        if (selectedNodes.length > 0 || selectedEdges.length > 0) {
          event.preventDefault();

          // Delete nodes
          if (selectedNodes.length > 0) {
            onNodeChange(
              selectedNodes.map((node) => ({
                id: node.id,
                type: 'remove' as const,
              })),
            );
          }

          // Delete edges
          if (selectedEdges.length > 0) {
            onEdgeChange(
              selectedEdges.map((edge) => ({
                id: edge.id,
                type: 'remove' as const,
              })),
            );
          }
        }
      }
    },
    [isViewMode, storeNodes, storeEdges, onNodeChange, onEdgeChange],
  );

  // Track mouse movement for collaborative cursors (throttled to 50ms)
  // We'll use a ref to store the screenToFlowPosition function
  const screenToFlowRef = useRef<
    ((pos: { x: number; y: number }) => { x: number; y: number }) | null
  >(null);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const now = Date.now();
      // Throttle updates to ~20 per second
      if (now - lastCursorUpdate.current < 50) {
        return;
      }
      lastCursorUpdate.current = now;

      // Convert screen position to flow position (canvas coordinates)
      if (screenToFlowRef.current) {
        const flowPosition = screenToFlowRef.current({
          x: event.clientX,
          y: event.clientY,
        });
        updateCursor(flowPosition);
      }
    },
    [updateCursor],
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
      <div
        className="flex-1 relative"
        ref={reactFlowWrapper}
        onMouseMove={handleMouseMove}
      >
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
          connectionRadius={50}
          nodesDraggable={!isViewMode}
          nodesConnectable={!isViewMode}
          nodesFocusable={!isViewMode}
          isValidConnection={(connection) =>
            connection.source !== connection.target
          }
          onInit={(reactFlowInstance) => {
            // Store the screenToFlowPosition function for cursor tracking
            screenToFlowRef.current = reactFlowInstance.screenToFlowPosition;
          }}
        >
          <Background variant={'dots' as BackgroundVariant} gap={12} size={1} />
          <Panel position="top-left" className="!top-5 !left-5">
            <AvatarDemo />
          </Panel>
          {!isViewMode && (
            <Panel position="bottom-center" className="!bottom-5 ">
              <AddNodeButton />
            </Panel>
          )}
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
            <Cursors />
          </ViewportPortal>
        </ReactFlow>
      </div>
      <NodeModal isViewMode={isViewMode} />
    </div>
  );
}

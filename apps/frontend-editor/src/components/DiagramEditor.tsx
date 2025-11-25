import { useEffect, useState, useRef, useCallback } from 'react';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import { useUserStore } from '@/lib/stores/userStore';
import {
  ReactFlow,
  Background,
  NodeTypes,
  Panel,
  BackgroundVariant,
  ViewportPortal,
  OnConnectStart,
  OnConnectEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowUpLeft } from 'lucide-react';
import AddNodeButton from '@/components/ui/addNodeButton';
import AvatarDemo from '@/components/ui/AvatarDemo';
import Cursors from '@/components/ui/Cursors';
import TopicNode from './nodes/topicNode';
import { LoadingOverlay } from './ui/loading-overlay';
import { NodeModal } from './NodeModal';
import {
  ConnectionContext,
  ConnectionState,
  isValidTargetHandle,
  areNodesConnected,
} from '@/lib/connectionUtils';
import { DiagramNode } from '@/types/reactflow';

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

  const { user, fetchCurrentUser, isLoading } = useUserStore();

  // Fallback guest user when authentication is not available
  const [guestUser] = useState({
    userId: `guest-${Math.random().toString(36).substring(2, 9)}`,
    userName: `Guest-${Math.random().toString(36).substring(2, 4).toUpperCase()}`,
  });

  // Track connection state for handle visibility
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    sourceNode: null,
    sourceHandleId: null,
  });

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const lastCursorUpdate = useRef<number>(0);

  const isViewMode = mode === 'view';

  // Fetch user data on mount (try to get real user)
  useEffect(() => {
    void fetchCurrentUser();
  }, [fetchCurrentUser]);

  // Initialize collaboration with real user OR guest user
  // Wait for initial load attempt to complete before initializing
  useEffect(() => {
    // Don't initialize until we've at least tried to fetch user (avoid double init)
    if (isLoading) return;

    // Use real user if available, otherwise use guest user
    const currentUser = user
      ? {
          userId: user.EntraID,
          userName: user.Name,
        }
      : guestUser;

    void initializeCollaboration(diagramName, currentUser, isViewMode);
  }, [
    diagramName,
    user,
    guestUser,
    initializeCollaboration,
    isViewMode,
    isLoading,
  ]);

  // Cleanup when component unmounts
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting - calling cleanup');
      cleanup();
    };
  }, [cleanup]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: DiagramNode) => {
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
    },
    [],
  );

  const handleBackButtonClick = useCallback(() => {
    // Use relative paths - nginx routes / to FE (frontend)
    if (isViewMode) {
      window.location.href = '/hub/learning-path';
    } else {
      window.location.href = '/creator/path-design';
    }
  }, [isViewMode]);

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

  // Track when connection drag starts
  const handleConnectStart = useCallback<OnConnectStart>(
    (_, { nodeId, handleId }) => {
      if (!nodeId || !handleId) return;
      const sourceNode = storeNodes.find((n) => n.id === nodeId);
      if (sourceNode) {
        setConnectionState({
          sourceNode,
          sourceHandleId: handleId,
        });
      }
    },
    [storeNodes],
  );

  // Clear connection state when drag ends
  const handleConnectEnd = useCallback<OnConnectEnd>(() => {
    setConnectionState({
      sourceNode: null,
      sourceHandleId: null,
    });
  }, []);

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
        <ConnectionContext.Provider value={connectionState}>
          <ReactFlow
            nodes={storeNodes}
            edges={storeEdges}
            onNodesChange={onNodeChange}
            onEdgesChange={onEdgeChange}
            onConnect={onConnect}
            onConnectStart={handleConnectStart}
            onConnectEnd={handleConnectEnd}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            snapToGrid={true}
            snapGrid={[15, 15]}
            fitView={true}
            fitViewOptions={fitViewOptions}
            minZoom={0.8}
            maxZoom={1.8}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={defaultEdgeOptions}
            elementsSelectable={true}
            edgesFocusable={true}
            edgesReconnectable={false}
            connectionRadius={50}
            nodesDraggable={!isViewMode}
            nodesConnectable={!isViewMode}
            nodesFocusable={!isViewMode}
            isValidConnection={(connection) => {
              // Prevent self-connections
              if (connection.source === connection.target) return false;

              // Prevent duplicate connections (including reverse connections)
              if (
                areNodesConnected(
                  storeEdges,
                  connection.source,
                  connection.target,
                )
              ) {
                return false;
              }

              // Find source and target nodes
              const sourceNode = storeNodes.find(
                (n) => n.id === connection.source,
              );
              const targetNode = storeNodes.find(
                (n) => n.id === connection.target,
              );

              if (!sourceNode || !targetNode) return false;

              // Validate that handlers face each other
              return isValidTargetHandle(
                sourceNode,
                targetNode,
                connection.sourceHandle ?? null,
                connection.targetHandle ?? null,
              );
            }}
            onInit={(reactFlowInstance) => {
              // Store the screenToFlowPosition function for cursor tracking
              screenToFlowRef.current = reactFlowInstance.screenToFlowPosition;
            }}
          >
            {!isViewMode && (
              <Background
                variant={'dots' as BackgroundVariant}
                gap={12}
                size={1}
              />
            )}
            <Panel position="top-left" className="!top-5 !left-5">
              <div
                className="group p-2 py-2.5 bg-white text-black rounded-full font-[12px] border border-gray-300 cursor-pointer shadow-sm hover:bg-black hover:text-white hover:border-black hover:px-3 hover:py-2.5 hover:pr-5.5 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap flex items-center gap-1"
                onClick={handleBackButtonClick}
              >
                <ArrowUpLeft className="inline-block w-6 h-6 pl-1 " />
                <span className="inline-block max-w-0 group-hover:max-w-xs transition-all duration-400 ease-in-out overflow-hidden ">
                  Back to Learning Paths
                </span>
              </div>
            </Panel>
            {!isViewMode && (
              <Panel position="top-right" className="!top-5 !right-5">
                <AvatarDemo />
              </Panel>
            )}
            {isViewMode ? (
              <Panel position="top-right" className="!top-5 !right-5">
                <div className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium border border-blue-200">
                  👁️ View Only
                </div>
              </Panel>
            ) : (
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
        </ConnectionContext.Provider>
      </div>
      <NodeModal />
    </div>
  );
}

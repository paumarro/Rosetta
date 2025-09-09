import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useCollaborativeStore } from '@/lib/stores/collaborativeStore';
import {
  ReactFlow,
  Background,
  Controls,
  // MiniMap,
  // addEdge,
  useNodesState,
  useEdgesState,
  // Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  // NodeChange,
  // EdgeChange,
  ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { io, Socket } from 'socket.io-client';
import { Button } from './ui/button';
import { Circle, Diamond } from 'lucide-react';
import CustomNode from './nodes/customNode';
import { LoadingOverlay } from './ui/loading-overlay';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

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
    socket: storeSocket,
    isConnected: storeIsConnected,
    connectedUsers,
    currentUser: storeCurrentUser,
    nodes: storeNodes,
    edges: storeEdges,
    onNodeChange,
    onEdgeChange,
    onConnect,
    addNode,
    diagramName: storeDiagramName,
  } = useCollaborativeStore();
  //  eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  //  eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser] = useState({
    userId: Math.random().toString(36).substring(2, 9),
    userName: `User-${Math.random().toString(36).substring(2, 4)}`,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading diagram...');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastLoadedData, setLastLoadedData] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  // Test initialization of collaborative store
  useEffect(() => {
    const testCollaborativeStore = async () => {
      console.log('[Store Test] Initializing collaborative store...');
      await initializeCollaboration(diagramName, currentUser);
      console.log('[Store Test] Initialization complete');
    };

    void testCollaborativeStore();
    return () => {
      console.log('Cleaning up collaborative store...');
      cleanup();
    };
  }, [diagramName, currentUser, initializeCollaboration, cleanup]);

  // Log store state changes
  useEffect(() => {
    console.log('[Store Test] Store state updated:', {
      isInitializing,
      storeSocket: storeSocket?.id,
      storeIsConnected,
      connectedUsers: connectedUsers.length,
      storeCurrentUser,
      storeNodes: storeNodes.length,
      storeEdges: storeEdges.length,
      storeDiagramName,
    });
  }, [
    isInitializing,
    storeSocket,
    storeIsConnected,
    connectedUsers,
    storeCurrentUser,
    storeNodes,
    storeEdges,
    storeDiagramName,
  ]);

  // Load diagram data
  useEffect(() => {
    const loadDiagram = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `http://localhost:3001/api/diagrams/${diagramName}`,
        );
        if (response.ok) {
          const data = (await response.json()) as {
            nodes: Node[];
            edges: Edge[];
          };
          setNodes(data.nodes);
          setEdges(data.edges);
          setLastLoadedData(data);
        }
      } catch (error) {
        console.error('Error loading diagram:', error);
        if (lastLoadedData) {
          setNodes(lastLoadedData.nodes);
          setEdges(lastLoadedData.edges);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadDiagram();
  }, [diagramName]);

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      query: {
        userId: currentUser.userId,
        userName: currentUser.userName,
        diagramName,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      console.log('[Socket] Connected to server', {
        socketId: newSocket.id,
        userId: currentUser.userId,
        userName: currentUser.userName,
        diagramName,
      });
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setIsConnected(false);
      setIsReconnecting(true);
      setLoadingMessage('Reconnecting to server...');
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      setIsReconnecting(true);
      setLoadingMessage(`Connection lost. Reconnecting... (${reason})`);
      console.log('[Socket] Disconnected from server:', reason);
    });

    // Handle real-time updates
    newSocket.on('nodes-updated', (updatedNodes: Node[]) => {
      if (updatedNodes.length > 0) {
        setNodes(updatedNodes);
        setLastLoadedData((prev) => ({
          nodes: updatedNodes,
          edges: prev?.edges || [],
        }));
      }
    });

    newSocket.on('edges-updated', (updatedEdges: Edge[]) => {
      if (updatedEdges.length > 0) {
        setEdges(updatedEdges);
        setLastLoadedData((prev) => ({
          nodes: prev?.nodes || [],
          edges: updatedEdges,
        }));
      }
    });

    setSocket(newSocket);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [
    currentUser.userId,
    currentUser.userName,
    diagramName,
    setEdges,
    setNodes,
  ]);

  // Handle local changes and broadcast to other users
  // const handleNodesChange = useCallback(
  //   (changes: NodeChange[]) => {
  //     onNodesChange(changes);
  //     if (socket && isConnected) {
  //       const hasNonSelectionChange = changes.some(
  //         (change) => change.type !== 'select',
  //       );
  //       if (hasNonSelectionChange) {
  //         if (updateTimeoutRef.current) {
  //           clearTimeout(updateTimeoutRef.current);
  //         }
  //         updateTimeoutRef.current = setTimeout(() => {
  //           socket.emit('nodes-updated', nodes, diagramName);
  //         }, 500);
  //       }
  //     }
  //   },
  //   [onNodesChange, socket, isConnected, nodes, diagramName],
  // );

  // const handleEdgesChange = useCallback(
  //   (changes: EdgeChange[]) => {
  //     onEdgesChange(changes);
  //     if (socket && isConnected) {
  //       const hasNonSelectionChange = changes.some(
  //         (change) => change.type !== 'select',
  //       );
  //       if (hasNonSelectionChange) {
  //         if (updateTimeoutRef.current) {
  //           clearTimeout(updateTimeoutRef.current);
  //         }
  //         updateTimeoutRef.current = setTimeout(() => {
  //           socket.emit('edges-updated', edges, diagramName);
  //         }, 500);
  //       }
  //     }
  //   },
  //   [onEdgesChange, socket, isConnected, edges, diagramName],
  // );

  // const onConnect = useCallback(
  //   (params: Connection) => {
  //     const { source, target, sourceHandle, targetHandle } = params;
  //     if (!source || !target) return;

  //     setEdges((eds) => {
  //       const updatedEdges = addEdge(
  //         {
  //           id: `e${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}`,
  //           source,
  //           target,
  //           sourceHandle: sourceHandle ?? null,
  //           targetHandle: targetHandle ?? null,
  //         },
  //         eds,
  //       );

  //       if (socket && isConnected) {
  //         socket.emit('edges-updated', updatedEdges, diagramName);
  //       }
  //       return updatedEdges;
  //     });
  //   },
  //   [setEdges, socket, isConnected, diagramName],
  // );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      let position = { x: 0, y: 0 };
      if (reactFlowInstance) {
        position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });
      }

      const newNode: Node = {
        id: `${type}-${String(Date.now())}`,
        type: 'custom',
        position,
        data: {
          label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        },
      };

      setNodes((nds) => {
        const updatedNodes = [...nds, newNode];
        if (socket && isConnected) {
          socket.emit('nodes-updated', updatedNodes, diagramName);
        }
        return updatedNodes;
      });
    },
    [reactFlowInstance, setNodes, socket, isConnected, diagramName],
  );

  // Show loading overlay when loading or reconnecting
  if (isLoading || isReconnecting) {
    return <LoadingOverlay message={loadingMessage} />;
  }

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
          onInit={setReactFlowInstance}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={nodeTypes}
          snapToGrid={true}
          snapGrid={[15, 15]}
          fitView
          attributionPosition="top-right"
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background variant={'dots' as BackgroundVariant} gap={12} size={1} />

          {/* Status Panel */}
          <Panel position="top-left">
            <div className="bg-white p-3 rounded-lg shadow-md border">
              <p className="text-sm text-gray-600 mt-1">
                {isConnected ? (
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
        </ReactFlow>
      </div>
    </div>
  );
}

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  // MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { io, Socket } from 'socket.io-client';
import { Button } from './ui/button';
import { Circle, Diamond, Save } from 'lucide-react';
import CustomNode from './nodes/customNode';

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser] = useState({
    userId: Math.random().toString(36).substring(2, 9),
    userName: `User-${Math.random().toString(36).substring(2, 4)}`,
  });
  const [isLoading, setIsLoading] = useState(true);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  // Load diagram data
  useEffect(() => {
    const loadDiagram = async () => {
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
        }
      } catch (error) {
        console.error('Error loading diagram:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDiagram();
  }, [diagramName, setNodes, setEdges]);

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
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected from server:', reason);
    });

    // Handle real-time updates
    newSocket.on('nodes-updated', (updatedNodes: Node[]) => {
      setNodes(updatedNodes);
    });

    newSocket.on('edges-updated', (updatedEdges: Edge[]) => {
      setEdges(updatedEdges);
    });

    newSocket.on('nodes-change', (changes: NodeChange[]) => {
      // Apply changes received from other users
      onNodesChange(changes);
    });

    newSocket.on('edges-change', (changes: EdgeChange[]) => {
      // Apply changes received from other users
      onEdgesChange(changes);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [
    currentUser.userId,
    currentUser.userName,
    diagramName,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
  ]);

  // Handle local changes and broadcast to other users
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      if (socket && isConnected) {
        socket.emit('nodes-change', changes);
      }
    },
    [onNodesChange, socket, isConnected],
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      if (socket && isConnected) {
        socket.emit('edges-change', changes);
      }
    },
    [onEdgesChange, socket, isConnected],
  );

  // Sync full state periodically
  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('nodes-updated', nodes);
    }
  }, [nodes, socket, isConnected]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('edges-updated', edges);
    }
  }, [edges, socket, isConnected]);

  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target, sourceHandle, targetHandle } = params;
      if (!source || !target) return;

      setEdges((eds) =>
        addEdge(
          {
            id: `e${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}`,
            source,
            target,
            sourceHandle,
            targetHandle,
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: string) => {
      const newNode: Node = {
        id: `${type}-${String(Date.now())}`,
        type: 'custom',
        position: {
          x: Math.random() * 400,
          y: Math.random() * 400,
        },
        data: {
          label: `What's the ${type.charAt(0).toUpperCase() + type.slice(1)} about?`,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  const saveDiagram = useCallback(async () => {
    try {
      console.log('Saving diagram with data:', { diagramName, nodes, edges });

      // First try to find if the diagram exists
      const checkResponse = await fetch(
        `http://localhost:3001/api/diagrams/${diagramName}`,
      );
      const method = checkResponse.ok ? 'PUT' : 'POST';

      const payload = {
        name: diagramName,
        nodes: nodes,
        edges: edges,
      };

      console.log('Sending payload:', payload);

      const response = await fetch(
        method === 'PUT'
          ? `http://localhost:3001/api/diagrams/${diagramName}`
          : 'http://localhost:3001/api/diagrams',
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error('Failed to save diagram');
      }

      console.log('Diagram saved successfully');
    } catch (error) {
      console.error('Error saving diagram:', error);
    }
  }, [diagramName, nodes, edges]);

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

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading diagram...
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* React Flow Editor */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
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
              <Button
                onClick={() => void saveDiagram()}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

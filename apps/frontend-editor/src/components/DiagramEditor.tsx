import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  // MiniMap,
  // addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  Panel,
  NodeChange,
  EdgeChange,
  ReactFlowInstance,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
// import { io, Socket } from "socket.io-client";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { Button } from "./ui/button";
import { Circle, Diamond } from "lucide-react";
import CustomNode from "./nodes/customNode";
import { LoadingOverlay } from "./ui/loading-overlay";
import { nanoid } from "nanoid";

const nodeTypes: NodeTypes = {
  custom: CustomNode,
  start: StartNode,
};

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

interface DiagramEditorProps {
  diagramName?: string;
  learningPathId?: string;
}

export default function DiagramEditor({
  diagramName = "default",
  learningPathId = "default",
}: DiagramEditorProps) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [isConnected, setIsConnected] = useState(false);
  const ydocRef = useRef<Y.Doc | null>(null);
  const yProviderRef = useRef<WebsocketProvider | null>(null);
  const [currentUser] = useState({
    userId: nanoid(8),
    userName: `User-${nanoid(3)}`,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage] = useState("Loading diagram...");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  // --- Yjs doc & provider setup ---
  useEffect(() => {
    // Create a new doc per learning path
    const doc = new Y.Doc();
    const provider = new WebsocketProvider("ws://localhost:3001", learningPathId, doc);
    ydocRef.current = doc;
    yProviderRef.current = provider;

    const yNodes = doc.getMap<Y.Map<unknown>>("nodes");
    const yEdges = doc.getMap<Y.Map<unknown>>("edges");

    const toRfNodes = (): Node[] => {
      return Array.from(yNodes.entries()).map(([id, yNode]) => {
        const type = (yNode.get("type") as string | undefined) ?? "custom";
        const position =
          (yNode.get("position") as { x: number; y: number } | undefined) ??
          { x: 0, y: 0 };
        const data =
          (yNode.get("data") as Record<string, unknown> | undefined) ?? {};
        return { id, type, position, data } as Node;
      });
    };

    const toRfEdges = (): Edge[] => {
      return Array.from(yEdges.entries()).map(([id, yEdge]) => {
        const source = (yEdge.get("source") as string | undefined) || "";
        const target = (yEdge.get("target") as string | undefined) || "";
        const sourceHandle = (yEdge.get("sourceHandle") as string | null) ?? null;
        const targetHandle = (yEdge.get("targetHandle") as string | null) ?? null;
        return { id, source, target, sourceHandle, targetHandle } as Edge;
      });
    };

    const applyFromY = () => {
      setNodes(toRfNodes());
      setEdges(toRfEdges());
    };

    // Initial sync and observers
    applyFromY();
    const nodesObserver = () => {
      applyFromY();
    };
    const edgesObserver = () => {
      applyFromY();
    };
    yNodes.observeDeep(nodesObserver);
    yEdges.observeDeep(edgesObserver);

    provider.on("status", (event: { status: string }) => {
      setIsConnected(event.status === "connected");
    });

    setIsLoading(false);

    return () => {
      yNodes.unobserveDeep(nodesObserver);
      yEdges.unobserveDeep(edgesObserver);
      provider.destroy();
      doc.destroy();
      ydocRef.current = null;
      yProviderRef.current = null;
    };
  }, [learningPathId, setNodes, setEdges]);

  // Cleanup timer reference
  useEffect(() => {
    return () => {
      const t = updateTimeoutRef.current;
      if (t) clearTimeout(t);
    };
  }, []);

  // Apply ReactFlow changes to Yjs
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yNodes = doc.getMap<Y.Map<unknown>>("nodes");
    const yEdges = doc.getMap<Y.Map<unknown>>("edges");

    changes.forEach((change) => {
      if (change.type === "position" && change.position) {
        // continuous updates
        const yNode = yNodes.get(change.id);
        if (yNode) {
          yNode.set("position", {
            x: change.position.x,
            y: change.position.y,
          });
        }
      }
      if (change.type === "remove") {
        // remove node and connected edges
        yNodes.delete(change.id);
        Array.from(yEdges.entries()).forEach(([edgeId, yEdge]) => {
          const source = yEdge.get("source") as string | undefined;
          const target = yEdge.get("target") as string | undefined;
          if (source === change.id || target === change.id) {
            yEdges.delete(edgeId);
          }
        });
      }
    });
  }, []);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yEdges = doc.getMap<Y.Map<unknown>>("edges");

    changes.forEach((change) => {
      if (change.type === "remove") {
        yEdges.delete(change.id);
      }
    });
  }, []);

  const onConnect = useCallback((params: Connection) => {
    const { source, target, sourceHandle, targetHandle } = params;
    if (!source || !target) return;

    const doc = ydocRef.current;
    if (!doc) return;
    const yEdges = doc.getMap<Y.Map<unknown>>("edges");
    const edgeId = `e${source}${sourceHandle ?? ""}-${target}${targetHandle ?? ""}`;
    const yEdge = new Y.Map<unknown>();
    yEdge.set("source", source);
    yEdge.set("target", target);
    yEdge.set("sourceHandle", sourceHandle ?? null);
    yEdge.set("targetHandle", targetHandle ?? null);
    yEdges.set(edgeId, yEdge);
  }, []);

  const addNode = useCallback((type: string) => {
    const doc = ydocRef.current;
    if (!doc) return;
    const yNodes = doc.getMap<Y.Map<unknown>>("nodes");
    const id = `${type}-${nanoid(8)}`;
    const yNode = new Y.Map<unknown>();
    yNode.set("type", "custom");
    yNode.set("position", { x: Math.random() * 400, y: Math.random() * 400 });
    yNode.set("data", {
      label: `What's the ${type.charAt(0).toUpperCase() + type.slice(1)} about?`,
    });
    yNodes.set(id, yNode);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData("application/reactflow");

      if (typeof type === "undefined" || !type) {
        return;
      }

      let position = { x: 0, y: 0 };
      if (reactFlowInstance) {
        position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });
      }

      const doc = ydocRef.current;
      if (!doc) return;
      const yNodes = doc.getMap<Y.Map<unknown>>("nodes");
      const id = `${type}-${nanoid(8)}`;
      const yNode = new Y.Map<unknown>();
      yNode.set("type", "custom");
      yNode.set("position", position);
      yNode.set("data", {
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
      });
      yNodes.set(id, yNode);
    },
    [reactFlowInstance],
  );

  // Show loading overlay while initializing Yjs
  if (isLoading) {
    return <LoadingOverlay message={loadingMessage} />;
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
          fitView={true}
          fitViewOptions={fitViewOptions}
          minZoom={0.8}
          maxZoom={1}
          attributionPosition="top-right"
        >
          <Controls />
          {/* <MiniMap /> */}
          <Background variant={"dots" as BackgroundVariant} gap={12} size={1} />

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
                  addNode("Topic");
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
                  addNode("Sub Topic");
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
    </div>
  );
}

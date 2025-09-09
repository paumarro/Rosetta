import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { FullDiagram } from '@/types/diagram';
import { DiagramNode, DiagramEdge } from '@/types/reactflow';
import {
  Connection,
  // addEdge,
  NodeChange,
  EdgeChange,
  // applyNodeChanges,
  // applyEdgeChanges,
} from '@xyflow/react';
import { io, Socket } from 'socket.io-client';

// TODO: Move types to the types folder later

interface User {
  userId: string;
  userName: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  color?: string;
}

interface CollaborativeState {
  // react Flow State
  nodes: DiagramNode[];
  edges: DiagramEdge[];

  //Connection State
  socket: Socket | null;
  isConnected: boolean;

  //Collaboration State
  connectedUsers: User[];
  currentUser: User | null;
  diagramName: string;

  //Loading States
  isInitializing: boolean;

  //Actions - Setup
  initializeCollaboration: (diagramName: string, user: User) => Promise<void>;
  cleanup: () => void;

  //Actions - React Flow Diagram Manipulation
  setNodes: (
    nodes: DiagramNode[] | ((nodes: DiagramNode[]) => DiagramNode[]),
  ) => void;
  onNodeChange: (changes: NodeChange[]) => void;
  onEdgeChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (type: string, position?: { x: number; y: number }) => void;

  // Actions - Collaboration
  updateCursor: (position: { x: number; y: number }) => void;
  updateSelection: (nodeIds: string[]) => void;

  // Actions - Broadcasting
  broadcastNodes: () => void;
  broadcastEdges: () => void;
}

//Collaboration Actions
//   updateCursor: (position: { x: number, y: number }) => {
//     const { socket, isConnected, currentUser } = get()
// if (socket && isConnected && currentUser) {
//   socket.emit('cursor-update', { userId: currentUser.userId, position })
// }
//   }

export const useCollaborativeStore = create<CollaborativeState>()(
  subscribeWithSelector((set, get) => ({
    //Initial State
    nodes: [],
    edges: [],
    socket: null,
    isConnected: false,
    connectedUsers: [],
    currentUser: null,
    diagramName: '',
    isInitializing: false,

    // Setup Actions

    initializeCollaboration: async (diagramName: string, user: User) => {
      const currentState = get();
      // Prevent multiple initializations
      if (
        currentState.isInitializing ||
        (currentState.socket && currentState.diagramName === diagramName)
      ) {
        console.log('[Store] Already initialized, skipping...');
        return;
      }
      // Cleanup existing connections
      if (currentState.socket) {
        console.log('[Store] Cleaning up existing connection...');
        get().cleanup(); // Disconnects AND cleanup state
      }

      set({
        isInitializing: true,
        diagramName,
        currentUser: user,
      });
      try {
        // 1. Fetching existing diagram data
        const response = await fetch(
          `http://localhost:3001/api/diagrams/${diagramName}`,
        );
        if (response.ok) {
          const diagram = (await response.json()) as FullDiagram;
          set({
            nodes: diagram.nodes,
            edges: diagram.edges,
          });
        }
        // 2. Initialize Websocket
        const newSocket = io('http://localhost:3001', {
          query: {
            userId: user.userId,
            userName: user.userName,
            diagramName: diagramName,
          },
        });

        // 3. Setup socket event listeners
        newSocket.on('connect', () => {
          console.log('[Store] Connected to collaboration server', {
            socketId: newSocket.id,
            userId: user.userId,
            userName: user.userName,
            diagramName: diagramName,
            nodes: currentState.nodes,
          });
          set({ isConnected: true });
        });

        newSocket.on('disconnect', (reason) => {
          console.log('Disconnected:', reason);
          set({ isConnected: false, connectedUsers: [] });
        });

        newSocket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          set({ isConnected: false });
        });

        // Real-time updates from other users
        newSocket.on('nodes-updated', (updatedNodes: DiagramNode[]) => {
          set({ nodes: updatedNodes });
        });

        newSocket.on('edges-updated', (updatedEdges: DiagramEdge[]) => {
          set({ edges: updatedEdges });
        });

        newSocket.on('users-updated', (users: User[]) => {
          set({ connectedUsers: users });
        });

        newSocket.on(
          'user-cursor',
          (userId: string, position: { x: number; y: number }) => {
            set((state) => ({
              connectedUsers: state.connectedUsers.map((u) =>
                u.userId === userId ? { ...u, cursor: position } : u,
              ),
            }));
          },
        );
        set({ socket: newSocket });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to load diagram:', errorMessage);
      } finally {
        set({ isInitializing: false });
      }
    },
    cleanup: () => {
      const { socket } = get();
      if (socket) {
        console.log('[Store Cleanup] Cleaning up socket connection');
        socket.disconnect();
        set({
          socket: null,
          isConnected: false,
          connectedUsers: [],
          currentUser: null,
          diagramName: '',
        });
      }
    },

    // React Flow Actions
    setNodes: (
      nodes: DiagramNode[] | ((nodes: DiagramNode[]) => DiagramNode[]),
    ) => {
      set((state) => ({
        nodes: typeof nodes === 'function' ? nodes(state.nodes) : nodes,
      }));
    },
    setEdges: (
      edges: DiagramEdge[] | ((edges: DiagramEdge[]) => DiagramEdge[]),
    ) => {
      set((state) => ({
        edges: typeof edges === 'function' ? edges(state.edges) : edges,
      }));
    },
    onNodeChange: () => {},
    onEdgeChange: () => {},
    onConnect: () => {},
    addNode: () => {},

    // Collaboration Actions
    updateCursor: () => {},
    updateSelection: () => {},

    // Broadcasting Actions
    broadcastNodes: () => {},
    broadcastEdges: () => {},
  })),
);

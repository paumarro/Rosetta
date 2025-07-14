import express, { Router, RequestHandler } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import { DiagramModel } from './models/diagram.js';
import { createServer as createNetServer } from 'net';

// Helper to wrap async Express handlers without violating eslint no-misused-promises
const wrapAsync = <
  P = Record<string, never>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, string>,
>(
  fn: (
    ...args: Parameters<RequestHandler<P, ResBody, ReqBody, ReqQuery>>
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> => {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
};

// Define types for request parameters and body
interface DiagramParams {
  name: string;
}

interface DiagramNode {
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    [key: string]: unknown;
  };
  measured?: {
    width: number;
    height: number;
  };
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface DiagramBody {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface ErrorResponse {
  error: string;
}

interface DiagramResponse {
  name: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  createdAt: Date;
  updatedAt: Date;
}

// (Removed unused Get*Handler type aliases)

const app = express();
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app);

// Function to find an available port
const findAvailablePort = async (startPort: number): Promise<number> => {
  const isPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const testServer = createNetServer()
        .once('error', (): void => {
          resolve(false);
        })

        .once('listening', (): void => {
          testServer
            .once('close', (): void => {
              resolve(true);
            })
            .close();
        })
        .listen(port);
    });
  };

  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
  }
  return port;
};

// Environment variables with defaults
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb://carbyte-academy-be-editor-mongodb-1:27017/carbyte-editor';
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173'
).split(',');

// MongoDB Connection with retry logic
const connectWithRetry = async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000; // 5 seconds
  let retries = 0;

  while (retries < MAX_RETRIES) {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      return;
    } catch (error) {
      console.error(
        `Failed to connect to MongoDB (attempt ${String(retries + 1)}/${String(MAX_RETRIES)}):`,
        error,
      );
      retries++;
      if (retries < MAX_RETRIES) {
        console.log(`Retrying in ${String(RETRY_DELAY / 1000)} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  console.error('Failed to connect to MongoDB after maximum retries');
  process.exit(1);
};

// Enhanced logging for connection attempts
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Add CORS logging middleware
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${String(req.headers.origin)}`,
  );
  next();
});

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  }),
);

app.use(express.json());

// Store connected users
const connectedUsers: Map<string, { userId?: string; userName?: string }> =
  new Map();

// Create router for API routes
const router = Router();

// REST API Routes
router.get(
  '/diagrams',
  wrapAsync<Record<string, never>, DiagramResponse[] | ErrorResponse, object>(
    async (_req, res) => {
      const diagrams = await DiagramModel.find().select(
        'name createdAt updatedAt',
      );
      res.json(diagrams);
    },
  ),
);

router.get(
  '/diagrams/:name',
  wrapAsync<DiagramParams, DiagramResponse | ErrorResponse>(
    async (req, res) => {
      const diagram = await DiagramModel.findOne({ name: req.params.name });
      if (!diagram) {
        return res.status(404).json({ error: 'Diagram not found' });
      }
      res.json(diagram);
    },
  ),
);

router.post(
  '/diagrams',
  wrapAsync<
    Record<string, never>,
    DiagramResponse | ErrorResponse,
    DiagramBody
  >(async (req, res) => {
    const { name, nodes, edges } = req.body;
    const diagram = new DiagramModel({ name, nodes, edges });
    await diagram.save();
    res.status(201).json(diagram);
  }),
);

router.put(
  '/diagrams/:name',
  wrapAsync<DiagramParams, DiagramResponse | ErrorResponse, DiagramBody>(
    async (req, res) => {
      const { nodes, edges } = req.body;
      const diagram = await DiagramModel.findOneAndUpdate(
        { name: req.params.name },
        { $set: { nodes, edges } },
        { new: true },
      );
      if (!diagram) {
        return res.status(404).json({ error: 'Diagram not found' });
      }
      res.json(diagram);
    },
  ),
);

// Mount the router
app.use('/api', router);

// Socket.IO handlers
io.on('connection', (socket) => {
  void (async () => {
    // Socket.IO query params can be string | string[] | undefined – normalize to string | undefined
    const rawQuery = socket.handshake.query;
    const userId = Array.isArray(rawQuery.userId)
      ? rawQuery.userId[0]
      : rawQuery.userId;
    const userName = Array.isArray(rawQuery.userName)
      ? rawQuery.userName[0]
      : rawQuery.userName;
    const diagramName = Array.isArray(rawQuery.diagramName)
      ? rawQuery.diagramName[0]
      : rawQuery.diagramName;

    console.log(`[${new Date().toISOString()}] User connected:`, {
      userId,
      userName,
      diagramName,
      socketId: socket.id,
      clientAddress: socket.handshake.address,
    });

    // Store user info
    connectedUsers.set(socket.id, { userId, userName });

    // Join diagram room if specified
    if (diagramName) {
      await socket.join(diagramName);

      // Load diagram state
      try {
        const diagram = await DiagramModel.findOne({ name: diagramName });
        if (diagram) {
          socket.emit('nodes-updated', diagram.nodes);
          socket.emit('edges-updated', diagram.edges);
        } else {
          // Create a new diagram if it doesn't exist
          const newDiagram = new DiagramModel({
            name: diagramName,
            nodes: [],
            edges: [],
          });
          await newDiagram.save();
          socket.emit('nodes-updated', []);
          socket.emit('edges-updated', []);
        }
      } catch (error) {
        console.error('Error loading diagram:', error);
      }
    }

    // Handle node changes
    socket.on('nodes-change', (changes: unknown) => {
      if (diagramName) {
        void socket.to(diagramName).emit('nodes-change', changes);
      }
    });

    socket.on('edges-change', (changes: unknown) => {
      if (diagramName) {
        void socket.to(diagramName).emit('edges-change', changes);
      }
    });

    // Handle direct state updates with persistence

    socket.on('nodes-updated', async (nodes: DiagramNode[]) => {
      if (diagramName) {
        try {
          console.log('Socket nodes-updated event:', { diagramName, nodes });
          console.log('Updating nodes in database:', nodes);
          await DiagramModel.findOneAndUpdate(
            { name: diagramName },
            { $set: { nodes } },
            { upsert: true, new: true },
          );
          void socket.to(diagramName).emit('nodes-updated', nodes);
        } catch (err) {
          console.error(
            'Error saving nodes:',
            err instanceof Error ? err.message : 'Unknown error',
          );
        }
      }
    });

    socket.on('edges-updated', async (edges: DiagramEdge[]) => {
      if (diagramName) {
        try {
          console.log('Socket edges-updated event:', { diagramName, edges });
          console.log('Updating edges in database:', edges);
          await DiagramModel.findOneAndUpdate(
            { name: diagramName },
            { $set: { edges } },
            { upsert: true, new: true },
          );
          void socket.to(diagramName).emit('edges-updated', edges);
        } catch (err) {
          console.error(
            'Error saving edges:',
            err instanceof Error ? err.message : 'Unknown error',
          );
        }
      }
    });

    // Handle cursor movement
    socket.on('cursor-move', (data) => {
      if (diagramName) {
        void socket.to(diagramName).emit('cursor-moved', data);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id);
      if (user) {
        console.log(
          `User ${String(user.userName)} (${String(user.userId)}) disconnected`,
        );
        if (diagramName) {
          void socket
            .to(diagramName)
            .emit('user-disconnected', { userId: user.userId });
        }
        connectedUsers.delete(socket.id);
      }
    });

    // Handle errors
    socket.on('error', (socketError) => {
      console.error(
        `[${new Date().toISOString()}] Socket error for user ${String(userName)}:`,
        socketError,
      );
    });
  })();
});

const startServer = async () => {
  // Connect to MongoDB first
  await connectWithRetry();

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  try {
    const availablePort = await findAvailablePort(PORT);
    await new Promise<void>((resolve, reject) => {
      void server
        .listen(availablePort, '0.0.0.0')
        .once('listening', () => {
          console.log(`Server running on port ${String(availablePort)}`);
          resolve();
        })
        .once('error', (err) => {
          reject(err);
        });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void startServer();

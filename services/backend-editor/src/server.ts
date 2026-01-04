import { createServer, IncomingMessage } from 'http';
import { connectDB } from './config/db.js';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { setupWSConnection, setPersistence } from '@y/websocket-server/utils';
import * as Y from 'yjs';
import { MongodbPersistence } from 'y-mongodb-provider';
import {
  authenticateUpgradeRequest,
  canAccessDocument,
} from './middleware/wsAuth.js';
import { createApp } from './app.js';

// MongoDB persistence instance (shared globally for cleanup endpoint)
export let mdbPersistence: MongodbPersistence;

const app = createApp();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/rosetta-editor';

// Initialize MongoDB persistence with y-mongodb-provider
const mdb = new MongodbPersistence(mongoUrl, {
  collectionName: 'yjs-documents',
  flushSize: 100, // Merge updates after 100 transactions
});
mdbPersistence = mdb;

// Configure Yjs persistence layer
setPersistence({
  bindState: (docName: string, ydoc: Y.Doc) => {
    // Skip persistence for test rooms
    if (docName.startsWith('TestCommunity/')) {
      return;
    }

    // Load and sync persisted state asynchronously
    void (async () => {
      const persistedYdoc = await mdb.getYDoc(docName);

      // Calculate diffs using state vectors for efficient sync
      const persistedStateVector = Y.encodeStateVector(persistedYdoc);
      const currentStateVector = Y.encodeStateVector(ydoc);

      // Store any new client updates
      const clientDiff = Y.encodeStateAsUpdate(ydoc, persistedStateVector);
      if (clientDiff.length > 2) {
        mdb.storeUpdate(docName, clientDiff);
      }

      // Apply persisted updates to current doc
      const serverDiff = Y.encodeStateAsUpdate(persistedYdoc, currentStateVector);
      if (serverDiff.length > 2) {
        Y.applyUpdate(ydoc, serverDiff);
      }
    })();

    // Persist all future updates
    ydoc.on('update', (update: Uint8Array) => {
      mdb.storeUpdate(docName, update);
    });
  },
  writeState: async () => {
    // Data already persisted via update handler
  },
  provider: mdb,
});

// Handle WebSocket upgrade with authentication and authorization
server.on('upgrade', (req: IncomingMessage, socket, head) => {
  void (async () => {
    try {
      // Extract document name from URL (strip query params)
      const urlPath = req.url || '/';
      const pathWithoutQuery = urlPath.split('?')[0];
      const docName = decodeURIComponent(pathWithoutQuery.slice(1));

      // Authenticate user
      const user = await authenticateUpgradeRequest(req);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Check CBAC authorization
      const hasAccess = canAccessDocument(user, docName);
      if (!hasAccess) {
        console.log(
          `CBAC denied: User ${user.email} (community: ${user.community}) cannot access ${docName}`,
        );
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Complete WebSocket upgrade
      wss.handleUpgrade(req, socket, head, (conn: WebSocket) => {
        setupWSConnection(conn, req, { docName, gc: true });
        wss.emit('connection', conn, req);
      });
    } catch (error) {
      console.error('WebSocket upgrade error:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  })();
});

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const instanceId = process.env.INSTANCE_ID || 'default';

  await new Promise<void>((resolve, reject) => {
    server
      .listen(PORT, '0.0.0.0')
      .once('listening', () => {
        console.log(`Server ${instanceId} running on port ${PORT}`);
        resolve();
      })
      .once('error', (err: unknown) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  wss.close(() => {
    console.log('WebSocket server closed');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

void startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

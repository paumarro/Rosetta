import { createServer, IncomingMessage } from 'http';
import { connectDB } from './config/db.js';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';
import * as Y from 'yjs';
import yMongo from 'y-mongodb';
import {
  authenticateUpgradeRequest,
  canAccessDocument,
} from './middleware/wsAuth.js';
import { createApp } from './app.js';

interface MongodbPersistenceType {
  getYDoc: (docName: string) => Promise<Y.Doc>;
  storeUpdate: (docName: string, update: Uint8Array) => Promise<void>;
  clearDocument: (docName: string) => Promise<void>;
}

const { MongodbPersistence } = yMongo as unknown as {
  MongodbPersistence: new (url: string, collection: string) => MongodbPersistenceType;
};

// MongoDB persistence instance (shared globally)
export let mdbPersistence: MongodbPersistenceType;

const app = createApp();
const server = createServer(app);

// Yjs websocket server with MongoDB persistence
// Use noServer: true to manually handle upgrade and authenticate BEFORE accepting connection
const wss = new WebSocketServer({ noServer: true });

const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/rosetta-editor';
const mdb = new MongodbPersistence(mongoUrl, 'yjs-documents');
mdbPersistence = mdb; // Export for cleanup endpoint

// Register MongoDB persistence with y-websocket
// See: https://github.com/fadiquader/y-mongodb#readme
setPersistence({
  bindState: async (docName: string, ydoc: Y.Doc) => {
    // Skip persistence for test rooms to avoid Yjs version conflicts
    if (docName.startsWith('TestCommunity/')) {
      console.log(`[Test Mode] Skipping persistence for test room: ${docName}`);
      return;
    }

    // Load persisted document from MongoDB
    const persistedYdoc = await mdb.getYDoc(docName);

    // Check if persisted doc has actual content (nodes, edges, or metadata)
    // Only apply if there's data to prevent overwriting with empty state
    const yNodes = persistedYdoc.getMap('nodes');
    const yEdges = persistedYdoc.getMap('edges');
    const yMetadata = persistedYdoc.getMap('metadata');
    const hasContent = yNodes.size > 0 || yEdges.size > 0 || yMetadata.size > 0;

    if (hasContent) {
      const persistedState = Y.encodeStateAsUpdate(persistedYdoc);
      Y.applyUpdate(ydoc, persistedState);
    }

    // Subscribe to future updates and persist them
    ydoc.on('update', (update: Uint8Array) => {
      mdb.storeUpdate(docName, update);
    });
  },
  writeState: async () => {
    // Called when all connections close - data already persisted via update handler
  },
  provider: mdb,
});

// Handle WebSocket upgrade - authenticate and check CBAC BEFORE accepting connection
server.on('upgrade', (req: IncomingMessage, socket, head) => {
  void (async () => {
    try {
      // Extract document name from URL path for CBAC check
      // Strip query parameters to ensure all connections to the same room share the same document
      const urlPath = req.url || '/';
      const pathWithoutQuery = urlPath.split('?')[0];
      let docName = decodeURIComponent(pathWithoutQuery.slice(1));

      // Authenticate user using local OIDC validation
      const user = await authenticateUpgradeRequest(req);

      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Check CBAC - user must have access to the document's community
      const hasAccess = canAccessDocument(user, docName);

      if (!hasAccess) {
        console.log(
          `CBAC denied: User ${user.email} (community: ${user.community}) cannot access document ${docName}`,
        );
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Authentication and authorization succeeded - complete the WebSocket upgrade
      wss.handleUpgrade(req, socket, head, (conn: WebSocket) => {
        // Setup Yjs connection (persistence is already configured via setPersistence)
        setupWSConnection(conn, req, { docName, gc: true });

        // Emit the 'connection' event for any other handlers
        wss.emit('connection', conn, req);
      });
    } catch (error) {
      console.error('Error during WebSocket upgrade:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  })();
});

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
  const instanceId = process.env.INSTANCE_ID || 'default';

  try {
    const listenPort = PORT;
    await new Promise<void>((resolve, reject) => {
      void server
        .listen(listenPort, '0.0.0.0')
        .once('listening', () => {
          console.log(`Server ${instanceId} running on port ${String(listenPort)}`);
          resolve();
        })
        .once('error', (err: unknown) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

void startServer();

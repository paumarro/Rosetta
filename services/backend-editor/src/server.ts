import express from 'express';
import diagramRoutes from './routes/diagramRoutes.js';
import { createServer, IncomingMessage } from 'http';
import corsMiddleware from './config/corsConfig.js';
import { connectDB } from './config/db.js';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import yMongo from 'y-mongodb';
const { MongodbPersistence } = yMongo as unknown as {
  MongodbPersistence: new (url: string) => unknown;
};

const app = express();
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app);

app.use(express.json());

app.use(corsMiddleware);

app.use('/api', diagramRoutes);

// Yjs websocket server with MongoDB persistence
// Use noServer: true to manually handle upgrade and authenticate BEFORE accepting connection
const wss = new WebSocketServer({ noServer: true });

const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/yjs';
const yPersistence = new MongodbPersistence(mongoUrl);

// Handle WebSocket upgrade - authenticate BEFORE accepting connection
server.on('upgrade', (req: IncomingMessage, socket, head) => {
  void (async () => {
    try {
      // Validate authentication from the upgrade request
      // Extract and validate token directly without needing a WebSocket object
      const cookies: Record<string, string> = {};
      const cookieHeader = req.headers.cookie;

      if (cookieHeader) {
        cookieHeader.split(';').forEach((cookie) => {
          const [name, ...rest] = cookie.split('=');
          const value = rest.join('=').trim();
          if (name) {
            cookies[name.trim()] = decodeURIComponent(value);
          }
        });
      }

      const accessToken = cookies['access_token'];
      // Validate token (import authService at top of file)
      const authService = (await import('./services/authService.js')).default;
      const validationResult = await authService.validateToken(accessToken);
      const user = authService.getUserFromValidation(validationResult);

      if (!accessToken || !validationResult.valid || !user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Authentication succeeded - now complete the WebSocket upgrade
      wss.handleUpgrade(req, socket, head, (conn: WebSocket) => {
        // Extract and decode document name from URL path
        const urlPath = req.url || '/';
        const docName = decodeURIComponent(urlPath.slice(1));

        // Setup Yjs connection immediately - no async gap, no message loss!
        setupWSConnection(conn, req, {
          docName: docName,
          persistence: yPersistence,
          gc: true,
        });

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
  try {
    // Bind to the configured port directly so clients can rely on ws://localhost:3001
    const listenPort = PORT;
    await new Promise<void>((resolve, reject) => {
      void server
        .listen(listenPort, '0.0.0.0')
        .once('listening', () => {
          console.log(`Server running on port ${String(listenPort)}`);
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

void startServer();

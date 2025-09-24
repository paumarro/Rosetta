import express from 'express';
import diagramRoutes from './routes/diagramRoutes.js';
import { createServer, IncomingMessage } from 'http';
import { Server } from 'socket.io';
import corsMiddleware from './config/corsConfig.js';
import { connectDB } from './config/db.js';
import { diagramSocket } from './sockets/diagramSockets.js';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';

const app = express();
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app);

const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(express.json());

app.use(corsMiddleware);

app.use('/api', diagramRoutes);

diagramSocket(io);

// Minimal Yjs websocket server (no persistence)

const wss = new WebSocketServer({ server });

wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
  setupWSConnection(conn, req);
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

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
const wss = new WebSocketServer({ server });

const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/yjs';
const yPersistence = new MongodbPersistence(mongoUrl);

wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
  setupWSConnection(conn, req, { persistence: yPersistence });
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

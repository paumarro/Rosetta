import express from 'express';
import diagramRoutes from './routes/diagramRoutes.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import corsMiddleware from './config/corsConfig.js';
import { connectDB } from './config/db.js';
import { findAvailablePort } from './config/serverConfig.js';
import { diagramSocket } from './sockets/diagramSockets.js';

const app = express();
// eslint-disable-next-line @typescript-eslint/no-misused-promises
const server = createServer(app);

const io = new Server(server, { cors: { origin: true, credentials: true } });

app.use(corsMiddleware);

app.use('/api', diagramRoutes);

app.use(express.json());

diagramSocket(io);

const startServer = async () => {
  await connectDB();

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

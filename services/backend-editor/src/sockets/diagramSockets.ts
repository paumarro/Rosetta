/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { Server } from 'socket.io';
import { DiagramModel } from '../models/diagramModel.js';
import { DiagramEdge, DiagramNode } from '../types/diagramTypes.js';

export const diagramSocket = (io: Server): void => {
  const connectedUsers: Map<string, { userId?: string; userName?: string }> =
    new Map();

  io.on('connection', (socket) => {
    void (async () => {
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

      connectedUsers.set(socket.id, { userId, userName });

      if (diagramName) {
        await socket.join(diagramName);

        try {
          const diagram = await DiagramModel.findOne({ name: diagramName });
          if (diagram) {
            socket.emit('nodes-updated', diagram.nodes);
            socket.emit('edges-updated', diagram.edges);
          } else {
            // If no diagram exists, create one with empty arrays
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
          // Send empty arrays on error
          socket.emit('nodes-updated', []);
          socket.emit('edges-updated', []);
        }
      }

      socket.on('nodes-updated', async (nodes: DiagramNode[]) => {
        if (diagramName) {
          try {
            console.log('Socket nodes-updated event:', { diagramName, nodes });
            const updatedDiagram = await DiagramModel.findOneAndUpdate(
              { name: diagramName },
              { $set: { nodes: nodes } },
              { upsert: true, new: true },
            );
            if (updatedDiagram) {
              io.to(diagramName).emit('nodes-updated', updatedDiagram.nodes);
            }
          } catch (err) {
            console.error(
              'Error saving nodes:',
              err instanceof Error ? err.message : 'Unknown error',
            );
          }
        }
      });

      socket.on('edges-updated', async (edges: DiagramEdge[]) => {
        if (!diagramName) return;

        try {
          console.log('Socket edges-updated event:', {
            diagramName,
            edges,
            socketId: socket.id,
          });

          // Always ensure edges is an array
          const safeEdges = Array.isArray(edges) ? edges : [];

          const updatedDiagram = await DiagramModel.findOneAndUpdate(
            { name: diagramName },
            { $set: { edges: safeEdges } },
            { upsert: true, new: true },
          );

          if (updatedDiagram) {
            // Broadcast to all clients in the room, including sender
            io.to(diagramName).emit('edges-updated', updatedDiagram.edges);
          }
        } catch (err) {
          console.error(
            'Error saving edges:',
            err instanceof Error ? err.message : 'Unknown error',
          );
          // On error, broadcast empty array to ensure consistency
          io.to(diagramName).emit('edges-updated', []);
        }
      });

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

      socket.on('error', (socketError) => {
        console.error(
          `[${new Date().toISOString()}] Socket error for user ${String(userName)}:`,
          socketError,
        );
      });
    })();
  });
};

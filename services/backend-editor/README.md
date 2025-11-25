# Diagram Editor Backend

This is the backend server for Rosettas diagram editor.

## Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Start the development server:

```bash
npm run dev
```

The server will run on port 3001 by default.

## Features

- Real-time synchronization of diagram changes
- User presence tracking
- Cursor position sharing
- WebSocket communication using Socket.IO

## API

The server uses WebSocket connections for real-time communication:

- `nodes-updated`: Broadcast node changes to all clients
- `edges-updated`: Broadcast edge changes to all clients
- `cursor-move`: Share cursor positions between users
- `user-disconnected`: Notify when users leave

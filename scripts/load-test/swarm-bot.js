/**
 * Yjs Load Testing Swarm Bot
 *
 * Simulates multiple concurrent users editing a collaborative diagram.
 * Uses Yjs with WebSocket provider to stress test the backend.
 */

const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');
const WebSocket = require('ws');

// Polyfill WebSocket for Node.js
global.WebSocket = WebSocket;

// Configuration from environment variables
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const ROOM_NAME = process.env.ROOM_NAME || 'TestCommunity/load-test-room';
const CLIENT_COUNT = parseInt(process.env.CLIENT_COUNT || '10', 10);
const UPDATE_INTERVAL_MS = parseInt(process.env.UPDATE_INTERVAL_MS || '2000', 10);
const DURATION_MS = parseInt(process.env.DURATION_MS || '60000', 10);
const RAMP_UP_MS = parseInt(process.env.RAMP_UP_MS || '5000', 10);

// Initial node count (created by first bot)
const INITIAL_NODE_COUNT = parseInt(process.env.INITIAL_NODE_COUNT || '5', 10);

// Bot behavior configuration (all configurable via environment variables)
const CREATE_NODE_PROBABILITY = parseFloat(process.env.CREATE_NODE_PROBABILITY || '0.15'); // 15% chance to create a new node
const CREATE_EDGE_PROBABILITY = parseFloat(process.env.CREATE_EDGE_PROBABILITY || '0.08'); // 8% chance to create an edge
const MOVE_PROBABILITY = parseFloat(process.env.MOVE_PROBABILITY || '0.40'); // 40% chance to move a node
const LABEL_UPDATE_PROBABILITY = parseFloat(process.env.LABEL_UPDATE_PROBABILITY || '0.20'); // 20% chance to update label
const LOCK_PROBABILITY = parseFloat(process.env.LOCK_PROBABILITY || '0.05'); // 5% chance to lock/unlock a node
const DELETE_NODE_PROBABILITY = parseFloat(process.env.DELETE_NODE_PROBABILITY || '0.12'); // 12% chance to delete a node

// Shared state
const bots = [];
let isShuttingDown = false;

// Avatar colors matching frontend
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
];

/**
 * Creates a bot that connects to the Yjs room and performs random edits
 */
class DiagramBot {
  constructor(botId) {
    this.botId = botId;
    this.userId = `bot-${botId}`;
    this.userName = `LoadBot${botId}`;
    this.doc = new Y.Doc();
    this.provider = null;
    this.updateInterval = null;
    this.connected = false;
    this.messageCount = 0;
    this.errorCount = 0;
    this.color = AVATAR_COLORS[botId % AVATAR_COLORS.length];
  }

  /**
   * Connect to the WebSocket server with test mode authentication
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Build WebSocket URL with test mode query parameters
        const params = new URLSearchParams({
          testUser: this.userId,
          testName: this.userName,
          testCommunity: 'TestCommunity',
        });

        const wsUrl = `${WS_URL}/${encodeURIComponent(ROOM_NAME)}?${params.toString()}`;

        this.provider = new WebsocketProvider(
          WS_URL,
          ROOM_NAME,
          this.doc,
          {
            params: {
              testUser: this.userId,
              testName: this.userName,
              testCommunity: 'TestCommunity',
            },
            WebSocketPolyfill: WebSocket,
          }
        );

        // Set up awareness
        const awareness = this.provider.awareness;
        awareness.setLocalState({
          userId: this.userId,
          userName: this.userName,
          color: this.color,
          mode: 'edit',
          cursor: { x: 0, y: 0 },
          selection: [],
          lastHeartbeat: Date.now(),
        });

        // Start awareness heartbeat (every 15 seconds like the frontend)
        this.heartbeatInterval = setInterval(() => {
          if (this.connected) {
            const currentState = awareness.getLocalState();
            awareness.setLocalState({
              ...currentState,
              lastHeartbeat: Date.now(),
            });
          }
        }, 15000);

        // Handle connection events
        this.provider.on('status', ({ status }) => {
          if (status === 'connected') {
            this.connected = true;
            console.log(`[Bot ${this.botId}] Connected to room: ${ROOM_NAME}`);
            resolve();
          } else if (status === 'disconnected') {
            this.connected = false;
            console.log(`[Bot ${this.botId}] Disconnected`);
          }
        });

        this.provider.on('sync', (synced) => {
          if (synced) {
            console.log(`[Bot ${this.botId}] Synced with server`);
          }
        });

        // Error handling
        this.provider.on('connection-error', (error) => {
          this.errorCount++;
          console.error(`[Bot ${this.botId}] Connection error:`, error.message);
          reject(error);
        });

        // Timeout for connection
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error(`Bot ${this.botId} connection timeout`));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get or create initial nodes in the diagram
   */
  ensureNodes() {
    const yNodes = this.doc.getMap('nodes');

    // If there are no nodes, create some initial ones
    if (yNodes.size === 0) {
      console.log(`[Bot ${this.botId}] Creating ${INITIAL_NODE_COUNT} initial nodes`);

      for (let i = 0; i < INITIAL_NODE_COUNT; i++) {
        const nodeId = `topic-${i}`;
        const nodeData = new Y.Map();

        nodeData.set('id', nodeId);
        nodeData.set('type', 'topic');
        nodeData.set('position', { x: 100 + i * 200, y: 100 });
        nodeData.set('data', {
          label: `Node ${i}`,
          side: i % 4,
          description: 'Initial node created by bot',
        });
        nodeData.set('isBeingEdited', false);
        nodeData.set('editedBy', null);

        yNodes.set(nodeId, nodeData);
      }
    }
  }

  /**
   * Generate a unique node ID
   */
  generateNodeId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `node-bot${this.botId}-${timestamp}-${random}`;
  }

  /**
   * Generate a unique edge ID
   */
  generateEdgeId(sourceId, targetId) {
    return `edge-${sourceId}-${targetId}-${Date.now()}`;
  }

  /**
   * Create a new node
   */
  createNode() {
    this.doc.transact(() => {
      const yNodes = this.doc.getMap('nodes');
      const nodeId = this.generateNodeId();
      const nodeData = new Y.Map();

      // Random position on canvas
      const position = {
        x: Math.random() * 800 + 100,
        y: Math.random() * 600 + 100,
      };

      // Random node type
      const nodeType = Math.random() > 0.3 ? 'topic' : 'subtopic';

      nodeData.set('id', nodeId);
      nodeData.set('type', nodeType);
      nodeData.set('position', position);
      nodeData.set('data', {
        label: `Node by Bot${this.botId}`,
        side: Math.floor(Math.random() * 4),
        description: `Created at ${new Date().toISOString()}`,
        resources: [],
      });
      nodeData.set('isBeingEdited', false);
      nodeData.set('editedBy', null);

      yNodes.set(nodeId, nodeData);
      this.messageCount++;

      console.log(`[Bot ${this.botId}] Created node: ${nodeId}`);
    });
  }

  /**
   * Create an edge between two random nodes
   */
  createEdge() {
    const yNodes = this.doc.getMap('nodes');
    const yEdges = this.doc.getMap('edges');
    const nodeIds = Array.from(yNodes.keys());

    if (nodeIds.length < 2) {
      return; // Need at least 2 nodes
    }

    this.doc.transact(() => {
      // Pick two random different nodes
      const sourceId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      let targetId = nodeIds[Math.floor(Math.random() * nodeIds.length)];

      // Ensure source and target are different
      while (targetId === sourceId && nodeIds.length > 1) {
        targetId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      }

      const edgeId = this.generateEdgeId(sourceId, targetId);
      const edgeData = new Y.Map();

      edgeData.set('id', edgeId);
      edgeData.set('source', sourceId);
      edgeData.set('target', targetId);
      edgeData.set('sourceHandle', null);
      edgeData.set('targetHandle', null);

      yEdges.set(edgeId, edgeData);
      this.messageCount++;

      console.log(`[Bot ${this.botId}] Created edge: ${sourceId} -> ${targetId}`);
    });
  }

  /**
   * Delete a random node
   */
  deleteNode() {
    const yNodes = this.doc.getMap('nodes');
    const yEdges = this.doc.getMap('edges');
    const nodeIds = Array.from(yNodes.keys());

    // Keep at least 3 nodes in the diagram
    if (nodeIds.length <= 3) {
      return;
    }

    this.doc.transact(() => {
      const nodeToDelete = nodeIds[Math.floor(Math.random() * nodeIds.length)];

      // Delete the node
      yNodes.delete(nodeToDelete);

      // Delete connected edges
      const edgeIds = Array.from(yEdges.keys());
      edgeIds.forEach(edgeId => {
        const edge = yEdges.get(edgeId);
        if (edge && (edge.get('source') === nodeToDelete || edge.get('target') === nodeToDelete)) {
          yEdges.delete(edgeId);
        }
      });

      this.messageCount++;
      console.log(`[Bot ${this.botId}] Deleted node: ${nodeToDelete}`);
    });
  }

  /**
   * Perform random updates on the diagram
   */
  performRandomUpdate() {
    if (!this.connected || isShuttingDown) {
      return;
    }

    try {
      const yNodes = this.doc.getMap('nodes');
      const nodeIds = Array.from(yNodes.keys());

      if (nodeIds.length === 0) {
        this.ensureNodes();
        return;
      }

      const action = Math.random();
      let threshold = 0;

      // Create new node
      if (action < (threshold += CREATE_NODE_PROBABILITY)) {
        this.createNode();
      }
      // Create new edge
      else if (action < (threshold += CREATE_EDGE_PROBABILITY)) {
        this.createEdge();
      }
      // Move existing node
      else if (action < (threshold += MOVE_PROBABILITY)) {
        const randomNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        const node = yNodes.get(randomNodeId);

        if (node) {
          this.doc.transact(() => {
            const currentPos = node.get('position');
            const newPos = {
              x: Math.max(0, currentPos.x + (Math.random() - 0.5) * 100),
              y: Math.max(0, currentPos.y + (Math.random() - 0.5) * 100),
            };
            node.set('position', newPos);
            this.messageCount++;
          });
        }
      }
      // Update label
      else if (action < (threshold += LABEL_UPDATE_PROBABILITY)) {
        const randomNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        const node = yNodes.get(randomNodeId);

        if (node) {
          this.doc.transact(() => {
            const currentData = node.get('data');
            const newData = {
              ...currentData,
              label: `Updated by Bot${this.botId} at ${Date.now()}`,
            };
            node.set('data', newData);
            this.messageCount++;
          });
        }
      }
      // Lock/unlock
      else if (action < (threshold += LOCK_PROBABILITY)) {
        const randomNodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        const node = yNodes.get(randomNodeId);

        if (node) {
          this.doc.transact(() => {
            const isBeingEdited = node.get('isBeingEdited');
            const editedBy = node.get('editedBy');

            if (!isBeingEdited || editedBy === this.userId) {
              node.set('isBeingEdited', !isBeingEdited);
              node.set('editedBy', isBeingEdited ? null : this.userId);
              this.messageCount++;
            }
          });
        }
      }
      // Delete node
      else if (action < (threshold += DELETE_NODE_PROBABILITY)) {
        this.deleteNode();
      }

      // Update cursor position in awareness
      const awareness = this.provider.awareness;
      const currentState = awareness.getLocalState();
      if (currentState) {
        awareness.setLocalState({
          ...currentState,
          cursor: {
            x: Math.random() * 1000,
            y: Math.random() * 800,
          },
        });
      }
    } catch (error) {
      this.errorCount++;
      console.error(`[Bot ${this.botId}] Update error:`, error.message);
    }
  }

  /**
   * Start performing random updates at intervals
   */
  startUpdating() {
    console.log(`[Bot ${this.botId}] Starting random updates every ${UPDATE_INTERVAL_MS}ms`);

    // Ensure initial nodes exist
    this.ensureNodes();

    // Perform updates at random intervals
    this.updateInterval = setInterval(() => {
      this.performRandomUpdate();
    }, UPDATE_INTERVAL_MS + Math.random() * 1000); // Add jitter
  }

  /**
   * Stop updating and disconnect
   */
  async disconnect() {
    console.log(`[Bot ${this.botId}] Disconnecting... (Messages: ${this.messageCount}, Errors: ${this.errorCount})`);

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.provider) {
      this.provider.destroy();
    }

    this.doc.destroy();
    this.connected = false;
  }

  /**
   * Get bot statistics
   */
  getStats() {
    return {
      botId: this.botId,
      connected: this.connected,
      messageCount: this.messageCount,
      errorCount: this.errorCount,
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Yjs Load Testing Swarm Bot ===');
  console.log(`WebSocket URL: ${WS_URL}`);
  console.log(`Room: ${ROOM_NAME}`);
  console.log(`Clients: ${CLIENT_COUNT}`);
  console.log(`Update Interval: ${UPDATE_INTERVAL_MS}ms`);
  console.log(`Duration: ${DURATION_MS}ms`);
  console.log(`Ramp-up: ${RAMP_UP_MS}ms`);
  console.log(`Initial Nodes: ${INITIAL_NODE_COUNT}`);
  console.log('\nBot Behavior:');
  console.log(`  Create Node: ${(CREATE_NODE_PROBABILITY * 100).toFixed(0)}%`);
  console.log(`  Delete Node: ${(DELETE_NODE_PROBABILITY * 100).toFixed(0)}%`);
  console.log(`  Move Node: ${(MOVE_PROBABILITY * 100).toFixed(0)}%`);
  console.log(`  Update Label: ${(LABEL_UPDATE_PROBABILITY * 100).toFixed(0)}%`);
  console.log(`  Create Edge: ${(CREATE_EDGE_PROBABILITY * 100).toFixed(0)}%`);
  console.log(`  Lock/Unlock: ${(LOCK_PROBABILITY * 100).toFixed(0)}%`);
  console.log('===================================\n');

  const rampUpDelay = RAMP_UP_MS / CLIENT_COUNT;

  // Create and connect bots with ramp-up
  for (let i = 0; i < CLIENT_COUNT; i++) {
    const bot = new DiagramBot(i);
    bots.push(bot);

    try {
      await bot.connect();
      bot.startUpdating();

      // Ramp-up delay between connections
      if (i < CLIENT_COUNT - 1) {
        await new Promise(resolve => setTimeout(resolve, rampUpDelay));
      }
    } catch (error) {
      console.error(`Failed to connect bot ${i}:`, error.message);
    }
  }

  console.log(`\nAll ${bots.length} bots connected and running...\n`);

  // Run for specified duration
  if (DURATION_MS > 0) {
    await new Promise(resolve => setTimeout(resolve, DURATION_MS));
    await shutdown();
  } else {
    // Run indefinitely until interrupted
    console.log('Running indefinitely. Press Ctrl+C to stop.\n');
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log('\n=== Shutting down bots ===');

  // Disconnect all bots
  const disconnectPromises = bots.map(bot => bot.disconnect());
  await Promise.all(disconnectPromises);

  // Print statistics
  console.log('\n=== Final Statistics ===');
  let totalMessages = 0;
  let totalErrors = 0;

  bots.forEach(bot => {
    const stats = bot.getStats();
    totalMessages += stats.messageCount;
    totalErrors += stats.errorCount;
  });

  console.log(`Total Bots: ${bots.length}`);
  console.log(`Total Messages Sent: ${totalMessages}`);
  console.log(`Total Errors: ${totalErrors}`);
  console.log(`Messages per Bot (avg): ${(totalMessages / bots.length).toFixed(2)}`);
  console.log('========================\n');

  process.exit(totalErrors > bots.length * 0.1 ? 1 : 0); // Exit with error if >10% error rate
}

// Handle signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

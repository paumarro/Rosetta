# Data Flow Diagrams

## 1. New Diagram Creation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant DE as DiagramEditor
    participant CS as CollaborativeStore
    participant API as Backend API
    participant WS as WebSocket
    participant T as Template

    U->>DE: Opens diagram URL
    DE->>DE: useEffect triggers
    DE->>CS: initializeCollaboration(diagramName, user)
    
    CS->>CS: Set isInitializing = true
    CS->>API: GET /api/diagrams/{diagramName}
    
    alt Diagram doesn't exist or is empty
        API-->>CS: Empty response or no nodes
        CS->>T: Load newDiagram.json
        T-->>CS: Template nodes & edges
        CS->>CS: set({ nodes: template.nodes, edges: template.edges })
    else Diagram exists
        API-->>CS: Existing diagram data
        CS->>CS: set({ nodes: diagram.nodes, edges: diagram.edges })
    end
    
    CS->>WS: Initialize Socket.IO connection
    WS-->>CS: Connection established
    CS->>CS: Set isInitializing = false
    CS-->>DE: Store state updated
    DE->>DE: Render ReactFlow with nodes/edges
```

## 2. Existing Diagram Loading Flow

```mermaid
sequenceDiagram
    participant U as User
    participant DE as DiagramEditor
    participant CS as CollaborativeStore
    participant API as Backend API
    participant WS as WebSocket
    participant DB as Database

    U->>DE: Opens existing diagram URL
    DE->>CS: initializeCollaboration(diagramName, user)
    
    CS->>API: GET /api/diagrams/{diagramName}
    API->>DB: Query diagram by name
    DB-->>API: Diagram data (nodes, edges)
    API-->>CS: Full diagram response
    
    CS->>CS: set({ nodes: diagram.nodes, edges: diagram.edges })
    CS->>WS: Connect with diagram context
    WS-->>CS: Real-time sync established
    
    CS-->>DE: Store populated with existing data
    DE->>DE: Render ReactFlow with loaded diagram
```

## 3. Real-time Collaboration Flow

```mermaid
sequenceDiagram
    participant U1 as User 1
    participant DE1 as DiagramEditor 1
    participant CS1 as Store 1
    participant WS as WebSocket Server
    participant CS2 as Store 2
    participant DE2 as DiagramEditor 2
    participant U2 as User 2

    U1->>DE1: Clicks "Add Topic"
    DE1->>CS1: addNode('Topic')
    CS1->>CS1: Create new node, update local state
    CS1->>WS: socket.emit('nodes-updated', nodes, diagramName)
    
    WS->>CS2: socket.on('nodes-updated', nodes)
    CS2->>CS2: set({ nodes: updatedNodes })
    CS2-->>DE2: State change triggers re-render
    DE2->>U2: New node appears in UI
    
    Note over U1,U2: Both users see the same diagram in real-time
```

## 4. Node Creation Detailed Flow

```mermaid
flowchart TD
    A[User clicks Add Topic] --> B[DiagramEditor.addNode('Topic')]
    B --> C[CollaborativeStore.addNode]
    C --> D[Generate unique ID with timestamp]
    D --> E[Calculate auto-position based on existing nodes]
    E --> F[Create DiagramNode object]
    F --> G[Add to local nodes array]
    G --> H{WebSocket connected?}
    H -->|Yes| I[Broadcast to other users]
    H -->|No| J[Store locally only]
    I --> K[Other users receive update]
    J --> L[ReactFlow re-renders with new node]
    K --> L
```

## 5. Component Interaction Flow

```mermaid
graph TD
    A[DiagramEditor] --> B[CollaborativeStore]
    A --> C[ReactFlow]
    C --> D[TopicNode Components]
    
    B --> E[WebSocket Client]
    B --> F[HTTP API Client]
    
    E --> G[Real-time Updates]
    F --> H[Diagram Persistence]
    
    D --> I[Handle User Interactions]
    I --> A
    
    G --> B
    H --> B
```

## 6. Store State Management

```mermaid
stateDiagram-v2
    [*] --> Loading: initializeCollaboration()
    Loading --> FetchingData: Set isInitializing = true
    FetchingData --> LoadTemplate: No existing data
    FetchingData --> LoadExisting: Has existing data
    LoadTemplate --> ConnectingWS: Load newDiagram.json
    LoadExisting --> ConnectingWS: Load from API
    ConnectingWS --> Ready: WebSocket connected
    Ready --> Ready: Handle user interactions
    Ready --> Cleanup: Component unmount
    Cleanup --> [*]: Disconnect & reset state
```

## 7. File Dependencies

```mermaid
graph LR
    A[DiagramEditor.tsx] --> B[collaborativeStore.ts]
    A --> C[TopicNode.tsx]
    A --> D[CustomNode.tsx - Legacy]
    A --> E[StartNode.tsx - Legacy]
    
    B --> F[newDiagram.json]
    B --> G[Socket.IO]
    B --> H[Backend API]
    
    C --> I[UI Components]
    D --> I
    E --> I
    
    B --> J[diagram.ts Types]
    B --> K[reactflow.ts Types]
    
    style D fill:#ffcccc
    style E fill:#ffcccc
    style F fill:#ccffcc
```

## 8. Template System Flow

```mermaid
flowchart TD
    A[New Diagram Request] --> B{Existing Data?}
    B -->|No| C[Load newDiagram.json]
    B -->|Yes but Empty| C
    B -->|Yes with Data| D[Load from Database]
    
    C --> E[Parse Template JSON]
    E --> F[Create Default Nodes]
    F --> G[Set in Store State]
    
    D --> H[Parse API Response]
    H --> I[Create Nodes from Data]
    I --> G
    
    G --> J[Render in ReactFlow]
```

---

These diagrams show the complete data flow for both new and existing diagram scenarios, helping team members understand how data moves through the system and where to look when debugging issues.
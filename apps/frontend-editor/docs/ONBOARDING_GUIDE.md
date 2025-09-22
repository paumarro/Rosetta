# FE-Editor Onboarding Guide

## Welcome to the Team! 🎉

This guide will get you up and running with the FE-Editor codebase quickly. Start here if you're new to the project.

## 🚀 Quick Start (5 minutes)

### 1. Understanding What We're Building
- **Product**: Collaborative diagram editor (like Miro/Figma for flowcharts)
- **Users**: Can create, edit, and share diagrams in real-time
- **Tech Stack**: React + TypeScript + ReactFlow + Zustand + Socket.IO

### 2. Key Concepts
- **Diagrams**: Flowcharts made of nodes and edges
- **Nodes**: Two types - Topics (main categories) and Subtopics (sub-categories)
- **Real-time**: Multiple users can edit the same diagram simultaneously
- **Templates**: New diagrams start with a default template

### 3. Essential Files (Start Here)
```
src/
├── components/
│   ├── DiagramEditor.tsx          # 🏠 MAIN COMPONENT - Start here!
│   └── nodes/
│       ├── TopicNode.tsx          # 🔄 New unified node component
│       ├── customNode.tsx         # ❌ Legacy - being replaced
│       └── startNode.tsx          # ❌ Legacy - being replaced
├── lib/
│   ├── stores/
│   │   └── collaborativeStore.ts  # 🧠 BRAIN - All state management
│   └── templates/
│       ├── newDiagram.json        # 📋 Default template for new diagrams
│       └── mockData.json          # 🧪 Test data
└── types/
    ├── diagram.ts                 # 📝 Type definitions
    └── reactflow.ts              # 📝 ReactFlow types
```

## 🎯 Your First Day Tasks

### Task 1: Follow a New Diagram Creation (15 mins)
1. Open `DiagramEditor.tsx` line 55
2. Find the `useEffect` that calls `initializeCollaboration`
3. Follow that function in `collaborativeStore.ts` line 95
4. See how it loads `newDiagram.json` if no data exists
5. Trace how the nodes get rendered in ReactFlow

### Task 2: Understand the Store Pattern (10 mins)
1. Open `collaborativeStore.ts`
2. Look at the interface `CollaborativeState` (line 25)
3. Find the `addNode` function (line 323)
4. See how it updates local state AND broadcasts via WebSocket

### Task 3: See Real-time in Action (5 mins)
1. Run the app: `npm run dev`
2. Open two browser tabs with the same diagram
3. Add a node in one tab, watch it appear in the other
4. Check browser console for `[CollaborativeStore]` logs

## 🧭 Navigation Guide

### "How do I...?"

#### Add a new node type?
1. Update `nodeTypes` in `DiagramEditor.tsx` (line 20)
2. Create component in `src/components/nodes/`
3. Update the `addNode` function in `collaborativeStore.ts`

#### Change the default template?
1. Edit `src/lib/templates/newDiagram.json`
2. Follow the existing structure

#### Debug collaboration issues?
1. Check WebSocket connection in browser dev tools
2. Look for `[CollaborativeStore]` logs in console
3. Verify backend is running on `localhost:3001`

#### Understand the data flow?
1. Read `DIAGRAM_SYSTEM_DOCS.md` for detailed explanations
2. Check `DATA_FLOW_DIAGRAMS.md` for visual diagrams

## 🏗️ Current Architecture Status

### What's Working
- ✅ Real-time collaboration via WebSocket
- ✅ Diagram persistence to database
- ✅ Basic node creation (Topic/Subtopic)
- ✅ ReactFlow integration

### What's In Progress
- 🔄 **Node System Refactor**: Moving from separate `CustomNode`/`StartNode` to unified `TopicNode`
- 🔄 **Template Cleanup**: Updating templates to match new node structure
- 🔄 **Type Simplification**: Removing redundant type fields

### Legacy Code (Don't Use)
- ❌ `CustomNode.tsx` - Use `TopicNode.tsx` instead
- ❌ `StartNode.tsx` - Use `TopicNode.tsx` instead
- ❌ `data.type` field in nodes - Use ReactFlow `type` field instead

## 🔍 Debugging Toolkit

### Console Logs to Watch
```javascript
[CollaborativeStore] Initializing...     // Store startup
[CollaborativeStore] Loaded diagram:     // Data loading
[CollaborativeStore] Added new node:     // Node creation
[Diagram Editor] Initializing...         // Component startup
```

### Common Issues & Solutions

| Problem | Likely Cause | Where to Look |
|---------|--------------|---------------|
| Nodes not appearing | `nodeTypes` mapping wrong | `DiagramEditor.tsx` line 20 |
| Real-time not working | WebSocket disconnected | Check browser Network tab |
| Template not loading | API error or JSON syntax | `newDiagram.json` + Network tab |
| Store not updating | Missing Zustand subscription | `collaborativeStore.ts` hooks |

### Browser Dev Tools Tips
1. **Network Tab**: Check API calls to `/api/diagrams/`
2. **WebSocket Tab**: Verify Socket.IO connection
3. **Console**: Look for error messages and store logs
4. **React DevTools**: Inspect component state

## 📚 Deep Dive Resources

### When You're Ready for More Detail
1. **`DIAGRAM_SYSTEM_DOCS.md`** - Complete system documentation
2. **`DATA_FLOW_DIAGRAMS.md`** - Visual data flow diagrams
3. **ReactFlow Docs** - https://reactflow.dev/
4. **Zustand Docs** - https://zustand-demo.pmnd.rs/

### Code Review Checklist
- [ ] Are you using the new `TopicNode` component?
- [ ] Did you update the store if you changed data structures?
- [ ] Are WebSocket events handled for real-time sync?
- [ ] Did you test with multiple browser tabs?
- [ ] Are your changes backward compatible with existing diagrams?

## 🤝 Getting Help

### Ask These Questions
1. **"Where does X happen?"** → Check the file structure above
2. **"How does Y work?"** → Follow the data flow in the docs
3. **"Why is Z broken?"** → Use the debugging toolkit
4. **"What's the context?"** → Read the architecture overview

### Code Reading Strategy
1. Start with `DiagramEditor.tsx` - the main component
2. Follow function calls into `collaborativeStore.ts`
3. Understand the data structures in `/types/`
4. Look at examples in `/templates/`

---

**Remember**: This is a collaborative editor, so always test with multiple browser tabs to ensure real-time features work correctly!

*Welcome to the team! 🚀*
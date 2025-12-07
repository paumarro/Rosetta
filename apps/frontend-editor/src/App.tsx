import { Routes, Route, useParams } from 'react-router-dom';
import DiagramEditor from './pages/DiagramEditor';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route
        path="/editor/:community/:diagramName"
        element={<DiagramEditorWrapper mode="edit" />}
      />
      <Route
        path="/view/:community/:diagramName"
        element={<DiagramEditorWrapper mode="view" />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Wrapper component to handle diagram name and community from URL
function DiagramEditorWrapper({ mode }: { mode: 'edit' | 'view' }) {
  const { diagramName, community } = useParams<{ diagramName: string; community: string }>();
  return <DiagramEditor diagramName={diagramName} community={community} mode={mode} />;
}

export default App;

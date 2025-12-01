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
        path="/editor/:diagramName"
        element={<DiagramEditorWrapper mode="edit" />}
      />
      <Route
        path="/view/:diagramName"
        element={<DiagramEditorWrapper mode="view" />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

// Wrapper component to handle diagram name from URL
function DiagramEditorWrapper({ mode }: { mode: 'edit' | 'view' }) {
  const { diagramName } = useParams<{ diagramName: string }>();
  return <DiagramEditor diagramName={diagramName} mode={mode} />;
}

export default App;

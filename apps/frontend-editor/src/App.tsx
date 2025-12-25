import { Routes, Route, useParams } from 'react-router-dom';
import DiagramEditor from './pages/DiagramEditor';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import { AuthProvider, RequireAuth } from '@shared/auth';
import { useUserStore } from './store/userStore';
import './App.css';

function App() {
  return (
    <AuthProvider userStore={useUserStore}>
      <Routes>
        <Route path="/" element={<RequireAuth><Index /></RequireAuth>} />
        <Route
          path="/editor/:community/:pathId"
          element={<RequireAuth><DiagramEditorWrapper mode="edit" /></RequireAuth>}
        />
        <Route
          path="/view/:community/:pathId"
          element={<RequireAuth><DiagramEditorWrapper mode="view" /></RequireAuth>}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

// Wrapper component to handle diagram name and community from URL
function DiagramEditorWrapper({ mode }: { mode: 'edit' | 'view' }) {
  const { pathId, community } = useParams<{
    pathId: string;
    community: string;
  }>();
  return <DiagramEditor pathId={pathId} community={community} mode={mode} />;
}

export default App;

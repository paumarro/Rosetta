import { Routes, Route, useParams, useLocation } from 'react-router-dom';
import DiagramEditor from './pages/DiagramEditor';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import { AuthProvider, RequireAuth } from '@shared/auth';
import { useUserStore } from './store/userStore';
import { TestUserProvider } from './components/TestUserProvider';
import './App.css';

/**
 * Wrapper that conditionally applies AuthProvider based on route
 * Test routes bypass authentication entirely
 */
function AppRoutes() {
  const location = useLocation();
  const isTestRoute =
    import.meta.env.DEV && location.pathname.startsWith('/test/');

  // Test routes - bypass AuthProvider entirely
  if (isTestRoute) {
    return (
      <Routes>
        <Route
          path="/test/editor/:community/:pathId"
          element={
            <TestUserProvider>
              <DiagramEditorWrapper mode="edit" />
            </TestUserProvider>
          }
        />
        <Route
          path="/test/view/:community/:pathId"
          element={
            <TestUserProvider>
              <DiagramEditorWrapper mode="view" />
            </TestUserProvider>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Normal routes - wrapped in AuthProvider
  return (
    <AuthProvider userStore={useUserStore}>
      <Routes>
        <Route
          path="/"
          element={
            <RequireAuth>
              <Index />
            </RequireAuth>
          }
        />
        <Route
          path="/editor/:community/:pathId"
          element={
            <RequireAuth>
              <DiagramEditorWrapper mode="edit" />
            </RequireAuth>
          }
        />
        <Route
          path="/view/:community/:pathId"
          element={
            <RequireAuth>
              <DiagramEditorWrapper mode="view" />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function App() {
  return <AppRoutes />;
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

import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import PathDesigner from '@/components/dashboard/PathDesigner';
import LearningPaths from '@/components/dashboard/LearningPaths';
import CommunityHub from '@/components/dashboard/CommunityHub';
import CreateNewPath from '@/components/creator-studio/CreateNewPath';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './wrappers/RequireAuth';
import Dashboard from './components/dashboard/Dashboard';

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <AuthProvider>
        <Routes>
          {/* Protected routes - only logged-in users */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          {/* Learning Hub sections */}
          <Route path="/hub">
            <Route
              path="learning-path"
              element={
                <RequireAuth>
                  <LearningPaths />
                </RequireAuth>
              }
            />
            <Route
              path=":communityname"
              element={
                <RequireAuth>
                  <CommunityHub />
                </RequireAuth>
              }
            />
            <Route
              path=":communityname/create-path"
              element={
                <RequireAuth>
                  <CreateNewPath />
                </RequireAuth>
              }
            />
          </Route>

          {/* Creator sections */}
          <Route path="/creator">
            <Route
              path="path-design"
              element={
                <RequireAuth>
                  <PathDesigner />
                </RequireAuth>
              }
            />
            <Route
              path="path-design/create-new"
              element={
                <RequireAuth>
                  <CreateNewPath />
                </RequireAuth>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </div>
  );
}

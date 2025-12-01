import Login from '@/pages/Login';
import { Person } from '@/pages/Person';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import PathDesigner from '@/components/dashboard/PathDesigner';
import LearningPaths from '@/components/dashboard/LearningPaths';
import CreateNewPath from '@/components/creator-studio/CreateNewPath';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './wrappers/RequireAuth';

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <AuthProvider>
        <Routes>
          {/* Public route - anyone can access */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes - only logged-in users */}
          <Route
            path="/"
            element={
              <RequireAuth>
                <LearningPaths />
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

          {/* Test and not implemented routes */}
          <Route path="/person" element={<Person />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </div>
  );
}

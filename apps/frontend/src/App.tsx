import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import CommunityHub from '@/components/dashboard/CommunityHub';
import CreateNewPath from '@/components/creator-studio/CreateNewPath';
import { AuthProvider, RequireAuth } from '@shared/auth';
import { useUserStore } from '@/store/userStore';
import Dashboard from './components/dashboard/Dashboard';

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <AuthProvider userStore={useUserStore}>
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

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </div>
  );
}

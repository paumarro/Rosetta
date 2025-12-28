import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import CommunityHub from '@/pages/CommunityHub';
import CreateLearningPath from '@/pages/CreateLearningPath';
import { AuthProvider, RequireAuth } from '@shared/auth';
import { useUserStore } from '@/store/userStore';
import Home from '@/pages/Home';

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
                <Home />
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
                  <CreateLearningPath />
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

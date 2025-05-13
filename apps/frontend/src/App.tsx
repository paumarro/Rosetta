import Home from '@/pages/Home';
import ApiTest from '@/pages/Apitest';
import Login from '@/pages/Login';
import { Person } from '@/pages/Person';
import Editor from '@/pages/Editor';
import WelcomePage from '@/pages/Welcome';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { NavigationProvider } from '@/components/nav-provider';
import PathDesigner from '@/components/dashboard/PathDesigner';
import LearningPaths from '@/components/dashboard/LearningPaths';
export default function App() {
  return (
    <NavigationProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Public route - anyone can access */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes - only logged-in users */}
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/" element={<Home />} />

          {/* Learning Hub sections */}
          <Route path="/hub">
            <Route path="learning-path" element={<LearningPaths />} />
          </Route>

          {/* Creator sections */}
          <Route path="/creator">
            <Route path="path-design" element={<PathDesigner />} />
          </Route>

          {/* Test and not implemented routes */}
          <Route path="/test" element={<ApiTest />} />
          <Route path="/person" element={<Person />} />
          <Route path="/editor" element={<Editor />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </NavigationProvider>
  );
}

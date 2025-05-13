import Home from '@/pages/Home';
import ApiTest from '@/pages/Apitest';
import Login from '@/pages/Login';
import { Person } from '@/pages/Person';
import Editor from '@/pages/Editor';
import WelcomePage from '@/pages/Welcome';
import './App.css';
import { Routes, Route } from 'react-router-dom';
import { NavigationProvider } from '@/components/nav-provider';
import PathDesigenr from './components/dashboard/PathDesigner';

export default function App() {
  return (
    <NavigationProvider>
      <div className="min-h-screen bg-background">
        <Routes>
          {/* Public route - anyone can access */}
          <Route path="/login" element={<Login />} />
          {/* Protected routes - only logged-in users */}
          <Route path="/home" element={<Home />} />
          <Route path="/test" element={<ApiTest />} />
          <Route path="/person" element={<Person />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/path-design" element={<PathDesigenr />} />
        </Routes>
      </div>
    </NavigationProvider>
  );
}

import Home from '@/pages/Home';
import ApiTest from '@/pages/Apitest';
import Login from '@/pages/Login';
import { Person } from '@/pages/Person';
import Editor from '@/pages/Editor';
import './App.css';
import { Routes, Route, Link } from 'react-router-dom';

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-fill-primary-weak p-4 flex gap-4">
        <Link to="/home">Home</Link>
        <Link to="/test">API Test</Link>
        <Link to="/login">Login</Link>
        <div>
          <form action="/api/login/logout" method="post">
            <button type="submit">Logout</button>
          </form>
        </div>
      </nav>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/test" element={<ApiTest />} />
        <Route path="/login" element={<Login />} />
        <Route path="/person" element={<Person />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </div>
  );
}

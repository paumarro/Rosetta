import Home from '@/pages/Home';
import ApiTest from '@/pages/Apitest';
import Login from '@/pages/Login';
import { Person } from '@/pages/Person';
import Editor from '@/pages/Editor';
import './App.css';
import { Routes, Route, Link } from 'react-router-dom';

export default function App() {
  return (
    <>
      <nav>
        <Link to="/home">Home</Link>
        <Link to="/test">API Test</Link>
        <Link to="/login">Login</Link>
      </nav>
      <form action="/api/login/logout" method="post">
        <button type="submit">Logout</button>
      </form>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/test" element={<ApiTest />} />
        <Route path="/login" element={<Login />} />
        <Route path="/person" element={<Person />} />
        <Route path="/editor" element={<Editor />} />
      </Routes>
    </>
  );
}

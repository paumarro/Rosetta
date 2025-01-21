import Home from './pages/Home';
import ApiTest from '@/pages/Apitest';
import './App.css';
import { Routes, Route, Link } from 'react-router-dom';

export default function App() {
  return (
    <>
      <nav>
        <Link to="/home">Home</Link>
        <Link to="/test">API Test</Link>
      </nav>
      <Routes>
        <Route path="/home" element={<Home />} />
        <Route path="/test" element={<ApiTest />} />
      </Routes>
    </>
  );
}

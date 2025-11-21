import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SessionPage from './components/SessionPage';
import ForgotPassowrd from './pages/ForgotPassword';
import Home from './pages/Home'; // ✅ Home-Seite importieren
import InviteRedirect from "./pages/InviteRedirect";

// ✅ Authentifizierungs-Wrapper
const RequireAuth = ({ children }) => {
  const token = localStorage.getItem('token');
  const guestToken = localStorage.getItem('guestToken');
  return (token || guestToken) ? children : <Navigate to="/login" replace />;
};

// ✅ Home-Komponente mit Weiterleitung, falls eingeloggt
const HomeRedirect = () => {
  const token = localStorage.getItem('token');
  return token ? <Navigate to="/dashboard" replace /> : <Home />;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 🏠 Home */}
        <Route path="/" element={<HomeRedirect />} />

        {/* 🔐 Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassowrd />} />
        <Route path="/invite/:token" element={<InviteRedirect />} />

        {/* 📊 Geschützte Seite */}
        <Route
          path="/dashboard"
          element={
              <Dashboard />
            
          }
        />

        {/* 🎧 Session */}
        <Route path="/session/:sessionId" element={<SessionPage />} />

        {/* ❓ Fallback: Unbekannte Route → Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

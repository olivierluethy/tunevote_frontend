import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SessionPage from './components/SessionPage';
import ForgotPassword from './pages/ForgotPassword'; // Korrektur: Tippfehler!
import ResetPassword from './pages/ResetPassword';   // <-- Diese Seite fehlt dir!
import Home from './pages/Home';
import InviteRedirect from "./pages/InviteRedirect";

// Auth-Wrapper
const RequireAuth = ({ children }) => {
  const token = localStorage.getItem('token');
  const guestToken = localStorage.getItem('guestToken');
  return (token || guestToken) ? children : <Navigate to="/login" replace />;
};

const HomeRedirect = () => <Home />;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* 🏠 Home */}
        <Route path="/" element={<HomeRedirect />} />

        {/* 🔐 Öffentliche Auth-Routen */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Neu: Password-Reset mit Token */}
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Einladungs-Weiterleitung */}
        <Route path="/invite/:token" element={<InviteRedirect />} />

        {/* Geschützte Routen */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/session/:sessionId"
          element={
            <RequireAuth>
              <SessionPage />
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
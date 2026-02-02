import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import SessionPage from "./components/SessionPage";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import InviteRedirect from "./pages/InviteRedirect";
import Profile from "./pages/Profile";
import ArtistDetail from "./pages/ArtistDetail";
import UserDetail from "./pages/UserDetail";
import GoogleCallback from "./components/GoogleCallback";   // oder wo du sie abgelegt hast


// 🔐 Nur für geschützte Bereiche (Dashboard usw.)
const RequireAuth = ({ children }) => {
  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  return token || guestToken ? children : <Navigate to="/login" replace />;
};


// 🚫 Auf Login/Register nicht zugelassen, wenn eingeloggt
const GuestOnly = ({ children }) => {
  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  return token || guestToken ? <Navigate to="/dashboard" replace /> : children;
};


// 🏠 Logik für den Home-Pfad (/)
const HomeRedirect = () => {
  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");

  // Wenn eingeloggt (normal oder Gast) -> ab zum Dashboard
  if (token || guestToken) {
    return <Navigate to="/dashboard" replace />;
  }

  // Wenn nicht eingeloggt -> schicke sie zum Login
  // (Oder falls du eine echte Landingpage hast, hier <Home /> zurückgeben)
  return <Navigate to="/login" replace />;
};


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>

        {/* 🏠 Home */}
        <Route path="/" element={<HomeRedirect />} />

        {/* Google OAuth Callback – öffentlich, kein Auth-Check */}
        <Route path="/auth/google/callback" element={<GoogleCallback />} />

        {/* ← HIER NEU */}
        <Route path="/google-callback" element={<GoogleCallback />} />

        {/* 🔐 Auth-only für Gäste */}
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />

        <Route
          path="/register"
          element={
            <GuestOnly>
              <Register />
            </GuestOnly>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <GuestOnly>
              <ForgotPassword />
            </GuestOnly>
          }
        />

        <Route
          path="/reset-password/:token"
          element={
            <GuestOnly>
              <ResetPassword />
            </GuestOnly>
          }
        />

        {/* Einladungen */}
        <Route path="/invite/:token" element={<InviteRedirect />} />


        {/* 🔐 Geschützte Bereiche */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        <Route path="/artist/:artistId" element={<ArtistDetail />} />

        <Route path="/user/:userId" element={<UserDetail />} />

        {/* 🟢 Öffentlich zugängliche Session-Seite */}
        <Route
          path="/session/:sessionId"
          element={<SessionPage />}
        />


        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

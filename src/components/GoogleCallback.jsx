// src/pages/GoogleCallback.jsx  (oder src/components/GoogleCallback.jsx)
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function GoogleCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const token    = params.get("token");
    const username = params.get("username");
    const userId   = params.get("userId");
    const error    = params.get("error");

    if (error) {
      // Optional: zeige Fehler an oder logge
      console.error("Google Login Fehler:", error);
      navigate("/login?error=google_failed");
      return;
    }

    if (token && userId) {
      localStorage.setItem("token", token);
      localStorage.setItem("username", username || "");
      localStorage.setItem("userId", userId);

      // Optional: kleine Bestätigung / Ladeanimation
      // setTimeout(() => navigate("/dashboard"), 800);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login?error=missing_token");
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900">
      <div className="text-white text-xl">Google Login wird verarbeitet...</div>
    </div>
  );
}
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function FacebookCallback() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const token    = params.get("token");
    const username = params.get("username");
    const userId   = params.get("userId");
    const error    = params.get("error");

    if (error) {
      console.error("Facebook Login Fehler:", error);
      navigate("/login?error=facebook_failed");
      return;
    }

    if (token && userId) {
      // Speichern der Login-Daten
      localStorage.setItem("token", token);
      localStorage.setItem("username", username || "");
      localStorage.setItem("userId", userId);

      // Weiterleitung zum Dashboard
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login?error=missing_token");
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-800 to-blue-600">
      <div className="text-white text-xl animate-pulse">
        Facebook Login wird verarbeitet...
      </div>
    </div>
  );
}
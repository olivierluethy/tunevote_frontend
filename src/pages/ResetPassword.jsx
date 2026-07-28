// src/pages/ResetPassword.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom"; // <-- useParams hinzufügen!
import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "https://api.tunevote.com").replace(/\/+$/, "");

export default function ResetPassword() {
  const { token } = useParams();           // RICHTIG: Token aus URL lesen!
  const navigate = useNavigate();          // Optional: für Weiterleitung nach Erfolg
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Optional: Prüfen ob Token überhaupt vorhanden ist
  useEffect(() => {
    if (!token) {
      setError("Kein gültiger Reset-Link.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/reset-password`, {
        token,
        newPassword: password,
      });

      setMessage("Dein Passwort wurde erfolgreich geändert! Du kannst dich jetzt anmelden.");
      setPassword("");
      setConfirmPassword("");

      // Optional: nach 2 Sekunden zum Login weiterleiten
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.error || "Fehler beim Zurücksetzen. Link möglicherweise abgelaufen."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">TuneVote</h1>
          <p className="text-gray-600 mt-2">Neues Passwort festlegen</p>
        </div>

        {message ? (
          <div className="text-center">
            <div className="mb-6 text-green-600 bg-green-50 px-4 py-3 rounded-lg border border-green-200">
              {message}
            </div>
            <a
              href="/login"
              className="inline-block bg-indigo-600 text-white font-semibold py-3 px-8 rounded-lg hover:bg-indigo-700 transition"
            >
              Jetzt anmelden
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Neues Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="8"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Passwort wiederholen
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3.5 rounded-lg hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed transition shadow-lg"
            >
              {loading ? "Wird gespeichert..." : "Passwort ändern"}
            </button>

            <p className="text-xs text-gray-500 text-center mt-6">
              Der Link läuft in Kürze ab. Bitte schließe den Vorgang bald ab.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
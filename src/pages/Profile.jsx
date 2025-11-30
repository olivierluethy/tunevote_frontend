// src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Save, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.tunevote.com';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default function Profile() {
  const [userData, setUserData] = useState({ username: '', email: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Zentrale Funktion: localStorage mit aktuellen User-Daten synchronisieren
  const syncUserToLocalStorage = (username, email) => {
    if (username) localStorage.setItem('username', username);
    if (email) localStorage.setItem('email', email);
    // Optional: Auch ein kombiniertes user-Objekt speichern (für andere Komponenten praktisch)
    localStorage.setItem('user', JSON.stringify({ username, email }));
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
  });

  // Beim Mount: Profil laden + localStorage aktualisieren
  useEffect(() => {
    const loadProfile = async () => {
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const res = await api.get('/profile', {
          headers: getAuthHeaders(),
        });

        const newUsername = res.data.username || '';
        const newEmail = res.data.email || '';

        setUserData({
          username: newUsername,
          email: newEmail,
        });

        // WICHTIG: localStorage sofort auf aktuellen Stand bringen
        syncUserToLocalStorage(newUsername, newEmail);
      } catch (err) {
        console.error('Fehler beim Laden des Profils:', err);

        const status = err.response?.status;
        if (status === 401 || status === 403) {
          localStorage.clear();
          navigate('/login');
          return;
        }

        setError('Konnte Profil nicht laden – bitte versuche es erneut');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [token, navigate]);

  // Formular abschicken
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    // Leere Passwort-Felder entfernen
    if (!data.currentPassword) delete data.currentPassword;
    if (!data.newPassword) delete data.newPassword;
    if (!data.confirmPassword) delete data.confirmPassword;

    try {
      const res = await api.post('/profile', data, {
        headers: getAuthHeaders(),
      });

      const updatedUsername = res.data.username || data.username;
      const updatedEmail = res.data.email || data.email;

      // UI aktualisieren
      setUserData({
        username: updatedUsername,
        email: updatedEmail,
      });

      // localStorage synchronisieren – das ist der entscheidende Teil!
      syncUserToLocalStorage(updatedUsername, updatedEmail);

      setSuccess(true);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);

      if (err.response?.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      setError(
        err.response?.data?.error ||
          'Fehler beim Speichern – bitte überprüfe deine Eingaben'
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center">
        <div className="text-white text-2xl">Lade Profil...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 pt-20 pb-12">
      <div className="max-w-2xl mx-auto px-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mein Profil
            </h1>
            <p className="text-white/70">Hier kannst du deine Daten bearbeiten</p>
          </div>
        </div>

        {/* Erfolgsmeldung */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300 text-center font-medium animate-pulse">
            Profil erfolgreich gespeichert!
          </div>
        )}

        {/* Fehlermeldung */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-center font-medium">
            {error}
          </div>
        )}

        {/* Formular */}
        <form onSubmit={handleSubmit} className="space-y-6 backdrop-blur-xl bg-black/40 rounded-3xl border border-white/20 p-8 shadow-2xl">
          {/* Benutzername */}
          <div>
            <label className="flex items-center gap-3 text-white/90 font-medium mb-3">
              <User className="w-5 h-5 text-purple-400" />
              Benutzername
            </label>
            <input
              type="text"
              name="username"
              defaultValue={userData.username}
              required
              minLength={3}
              maxLength={50}
              className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          {/* E-Mail */}
          <div>
            <label className="flex items-center gap-3 text-white/90 font-medium mb-3">
              <Mail className="w-5 h-5 text-purple-400" />
              E-Mail-Adresse
            </label>
            <input
              type="email"
              name="email"
              defaultValue={userData.email}
              required
              className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          {/* Passwort ändern */}
          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xl font-semibold text-white mb-4">
              Passwort ändern (optional)
            </h3>

            <div className="space-y-4">
              <input
                type="password"
                name="currentPassword"
                placeholder="Aktuelles Passwort"
                className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  name="newPassword"
                  placeholder="Neues Passwort (min. 8 Zeichen)"
                  className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Wiederholen"
                  className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Speichern */}
          <button
            type="submit"
            className="w-full mt-8 py-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-purple-500/25"
          >
            <Save className="w-6 h-6" />
            Änderungen speichern
          </button>
        </form>
      </div>
    </div>
  );
}
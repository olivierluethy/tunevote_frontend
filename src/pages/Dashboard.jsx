// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  const [sessions, setSessions] = useState([]);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) fetchSessions();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    navigate('/login');
  };

  const fetchSessions = async () => {
    if (!token) return;
    try {
      const res = await axios.get('http://localhost:4000/sessions', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessions(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        console.error('Fehler beim Laden der Sessions:', err);
      }
    }
  };

  const createSession = async () => {
    if (!newSessionTitle.trim() || loading) return;
    setLoading(true);
    try {
      const res = await axios.post(
        'http://localhost:4000/sessions',
        { title: newSessionTitle },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessions(prev => [res.data, ...prev]);
      setNewSessionTitle('');
    } catch (err) {
      console.error(err);
      alert('Fehler beim Erstellen der Session');
    } finally {
      setLoading(false);
    }
  };

  const openSession = (session) => {
    navigate(`/session/${session.id}`);
  };

  const copyJoinLink = (sessionId) => {
    const link = `${window.location.origin}/session/${sessionId}`;
    navigator.clipboard.writeText(link);
    alert('Link kopiert!');
  };

  if (!token) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <header className="bg-white shadow-md p-6 mb-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-bold text-blue-700">Welcome, {username}!</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Session erstellen */}
        <section className="mb-10 bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Neue Session erstellen</h2>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="z.B. Chill Abend"
              className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createSession()}
              disabled={loading}
            />
            <button
              onClick={createSession}
              disabled={loading || !newSessionTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-6 rounded-lg transition"
            >
              {loading ? '...' : 'Erstellen'}
            </button>
          </div>
        </section>

        {/* Sessions Liste */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Deine Sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Noch keine Sessions. Erstelle eine!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition cursor-pointer border border-gray-100"
                  onClick={() => openSession(s)}
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">Host: {s.host}</p>
                  <p className="text-xs text-gray-500 mb-3">
                    {new Date(s.created_at).toLocaleString()}
                  </p>

                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1">
                      <QRCodeCanvas value={`${window.location.origin}/session/${s.id}`} size={80} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyJoinLink(s.id);
                      }}
                      className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 py-1 px-2 rounded transition"
                    >
                      Link kopieren
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
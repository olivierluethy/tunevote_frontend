import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';

export default function Dashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  const [sessions, setSessions] = useState([]);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  const fetchSessions = async () => {
    const res = await axios.get('http://localhost:4000/sessions');
    setSessions(res.data);
  };

  const createSession = async () => {
    if (!newSessionTitle) return;
    const res = await axios.post('http://localhost:4000/sessions', {
      title: newSessionTitle,
      userId: 1, // TODO: aus Token oder Backend bestimmen
    });
    fetchSessions();
    setNewSessionTitle('');
  };

  const selectSession = async (session) => {
    setSelectedSession(session);
    const res = await axios.get(`http://localhost:4000/sessions/${session.id}/queue`);
    setQueue(res.data);
  };

  const searchVideos = async () => {
    if (!searchQuery) return;
    const res = await axios.get(
      `https://www.googleapis.com/youtube/v3/search`,
      {
        params: {
          part: 'snippet',
          type: 'video',
          maxResults: 5,
          q: searchQuery,
          key: 'YOUR_YOUTUBE_API_KEY',
        },
      }
    );
    setSearchResults(res.data.items);
  };

  const addToQueue = async (video) => {
    if (!selectedSession) return;
    await axios.post(`http://localhost:4000/sessions/${selectedSession.id}/queue`, {
      videoId: video.id.videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.medium.url,
      addedBy: 1, // TODO: aus Token bestimmen
    });
    const res = await axios.get(`http://localhost:4000/sessions/${selectedSession.id}/queue`);
    setQueue(res.data);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`http://localhost:3000/session/${selectedSession.id}`);
    alert('Link copied to clipboard!');
  };

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
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create New Session</h2>
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Session title"
              className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
            />
            <button
              onClick={createSession}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200"
            >
              Create
            </button>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">All Sessions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="bg-white p-5 rounded-lg shadow-lg hover:shadow-xl transition duration-300 cursor-pointer border border-gray-100"
                onClick={() => selectSession(s)}
              >
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600">Host: {s.host}</p>
                <p className="text-xs text-gray-500">{new Date(s.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        {selectedSession && (
          <section className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Session: {selectedSession.title}</h2>
            <div className="mb-6">
              <div className="flex flex-col items-center space-y-4">
                <QRCodeCanvas value={`http://localhost:3000/session/${selectedSession.id}`} size={150} />
                <div>
                  <p className="text-sm text-gray-600 mb-2">Share this session:</p>
                  <button
                    onClick={handleCopyLink}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Search YouTube</h3>
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Search for videos"
                  className="flex-1 border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={searchVideos}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-5 rounded-lg transition duration-200"
                >
                  Search
                </button>
              </div>
            </div>

            <div className="mb-6">
              {searchResults.map((video) => (
                <div key={video.id.videoId} className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg">
                  <img src={video.snippet.thumbnails.default.url} alt="" className="w-16 h-16 rounded" />
                  <p className="flex-1 ml-4 text-gray-800">{video.snippet.title}</p>
                  <button
                    onClick={() => addToQueue(video)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Queue</h3>
              {queue.map((item) => (
                <div key={item.id} className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg">
                  {item.thumbnail && <img src={item.thumbnail} className="w-16 h-16 rounded" />}
                  <p className="flex-1 ml-4 text-gray-800">{item.title}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
// src/components/SessionPage.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import io from 'socket.io-client';

const SOCKET_SERVER = 'http://localhost:4000';

const SessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const playerRef = useRef(null);
  const socketRef = useRef(null);

  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [userVote, setUserVote] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [nickname, setNickname] = useState('Gast');
  const [showGuestModal, setShowGuestModal] = useState(false);

  const token = localStorage.getItem('token');
  const guestToken = localStorage.getItem('guestToken');
  const userId = localStorage.getItem('userId');

  // === WebSocket Setup ===
  useEffect(() => {
    if (!token && !guestToken) {
      setShowGuestModal(true);
      return;
    }

    socketRef.current = io(SOCKET_SERVER, {
      query: { sessionId },
      auth: token ? { token } : { guestToken },
    });

    socketRef.current.on('playback_state', (state) => {
      if (state.is_playing && state.current_video_id) {
        if (!currentSong || currentSong.videoId !== state.current_video_id) {
          playerRef.current?.loadVideoById(state.current_video_id, state.progress_seconds);
        } else {
          const diff = Math.abs(playerRef.current?.getCurrentTime() - state.progress_seconds);
          if (diff > 2) {
            playerRef.current?.seekTo(state.progress_seconds);
          }
        }
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [sessionId, token, guestToken, currentSong]);

  // === YouTube Player ===
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: { controls: 0, autoplay: 1, modestbranding: 1 },
        events: {
          onReady: () => console.log('YouTube Player ready'),
          onStateChange: onPlayerStateChange,
        },
      });
    };
  }, []);

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.ENDED && queue.length > 0) {
      playNext();
    }
    if (event.data === window.YT.PlayerState.PLAYING && isHost) {
      const progress = playerRef.current?.getCurrentTime() || 0;
      socketRef.current?.emit('host_play', {
        videoId: currentSong?.videoId,
        progress,
      });
    }
    if (event.data === window.YT.PlayerState.PAUSED && isHost) {
      const progress = playerRef.current?.getCurrentTime() || 0;
      socketRef.current?.emit('host_pause', progress);
    }
  };

  const playNext = () => {
    if (queue.length === 0) return;
    const next = queue[0];
    setCurrentSong(next);
    playerRef.current?.loadVideoById(next.videoId);
    setQueue(prev => prev.slice(1));
  };

  // === Auth Headers ===
  const getAuthHeaders = () => {
  const headers = {};
  const token = localStorage.getItem('token');
  const guestToken = localStorage.getItem('guestToken');

  if (token && !guestToken) headers.Authorization = `Bearer ${token}`;
  else if (guestToken && !token) headers['x-guest-token'] = guestToken;
  return headers;
};


  // === Daten laden ===
  const loadSessionData = useCallback(async () => {
    try {
      const [sessRes, queueRes, propRes] = await Promise.all([
  axios.get(`http://localhost:4000/sessions/${sessionId}`, { headers: getAuthHeaders() }),
  axios.get(`http://localhost:4000/sessions/${sessionId}/queue`, { headers: getAuthHeaders() }),
  axios.get(`http://localhost:4000/sessions/${sessionId}/proposals`, { headers: getAuthHeaders() }),
]);


      setSession(sessRes.data);
      console.log('Queue Response:', queueRes.data);

      setQueue(queueRes.data);
      setProposals(propRes.data);

      // Host prüfen
      if (sessRes.data.hostId == userId) {
        setIsHost(true);
      }

      // Starte Wiedergabe, wenn Queue vorhanden
      if (queueRes.data.length > 0 && !currentSong) {
        playNext();
      }
    } catch (err) {
      console.error('Load session error:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('guestToken');
        setShowGuestModal(true);
      } else if (err.response?.status === 404) {
        alert('Session nicht gefunden');
        navigate('/dashboard');
      }
    }
  }, [sessionId, currentSong, navigate, userId]);

  useEffect(() => {
    if (token || guestToken) {
      loadSessionData();
      const interval = setInterval(loadSessionData, 5000);
      return () => clearInterval(interval);
    }
  }, [loadSessionData, token, guestToken]);

  // === YouTube Suche ===
  const searchYouTube = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          type: 'video',
          maxResults: 5,
          q: searchQuery,
          key: '__REDACTED_GOOGLE_KEY__',
        },
      });
      setSearchResults(res.data.items);
    } catch (err) {
      console.error('YouTube search error:', err);
    }
  };

  // === Vorschlag hinzufügen ===
  const proposeSong = async (video) => {
    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/proposals`,
        {
          videoId: video.id.videoId,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.medium.url,
        },
        { headers: getAuthHeaders() }
      );
      setSearchResults([]);
      setSearchQuery('');
      loadSessionData();
    } catch (err) {
      alert('Vorschlag fehlgeschlagen');
    }
  };

  // === Voting ===
  const vote = async (proposalId) => {
    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/proposals/${proposalId}/vote`,
        {},
        { headers: getAuthHeaders() }
      );
      setUserVote(prev => ({ ...prev, [proposalId]: !prev[proposalId] }));
      loadSessionData();
    } catch (err) {
      alert('Vote fehlgeschlagen');
    }
  };

  // === Host: Direkt in Queue ===
  const addToQueueDirectly = async (proposal) => {
    if (!isHost) return;
    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/queue/add`,
        {
          videoId: proposal.videoId,
          title: proposal.title,
          thumbnail: proposal.thumbnail,
        },
        { headers: getAuthHeaders() }
      );
      loadSessionData();
    } catch (err) {
      alert('Fehler beim Hinzufügen');
    }
  };

  // === Guest Join Modal ===
  const handleGuestJoin = async () => {
    if (!nickname.trim()) return;
    try {
      const res = await axios.post('http://localhost:4000/guest/join', { nickname });
      localStorage.setItem('guestToken', res.data.guestToken);
      setShowGuestModal(false);
      loadSessionData();
    } catch (err) {
      alert('Fehler beim Beitreten');
    }
  };

  // === Guest Modal ===
  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-blue-700 mb-4">Willkommen!</h2>
          <p className="text-gray-600 mb-6">Gib einen Namen ein, um der Session beizutreten:</p>
          <input
            type="text"
            placeholder="z.B. Max"
            className="w-full border rounded-lg p-3 mb-4"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleGuestJoin()}
          />
          <button
            onClick={handleGuestJoin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Beitreten
          </button>
        </div>
      </div>
    );
  }

  // === Ladezustand ===
  if (!session) {
    return <div className="p-8 text-center">Lade Session...</div>;
  }

  // === Haupt-UI ===
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Session: {session.title}</h1>
          {token ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Zurück
            </button>
          ) : (
            <div className="text-sm text-gray-500">Gast: {nickname}</div>
          )}
        </div>

        {/* Share Link */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center justify-center gap-4">
          <QRCodeCanvas value={window.location.href} size={100} />
          <div>
            <p className="text-sm text-gray-600">Teile diesen Link:</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link kopiert!');
              }}
              className="text-blue-600 hover:underline text-sm"
            >
              {window.location.href}
            </button>
          </div>
        </div>

        {/* Warteschlange */}
<div className="lg:col-span-1">
  <div className="bg-white p-5 rounded-lg shadow">
    <h2 className="text-xl font-semibold mb-3">
      Warteschlange ({Array.isArray(queue) ? queue.length : 0})
    </h2>

    {!Array.isArray(queue) ? (
      <p className="text-red-500">Fehler: Daten ungültig</p>
    ) : queue.length === 0 ? (
      <p className="text-gray-500">Noch leer</p>
    ) : (
      queue.map((song, i) => (
        <div key={song.id} className="flex items-center gap-3 p-2 border-b">
          {song.thumbnail && (
            <img src={song.thumbnail} alt={song.title} className="w-12 h-12 rounded" />
          )}
          <div className="flex-1 text-sm">
            <p className="font-medium">{song.title}</p>
            <p className="text-xs text-gray-500">von {song.addedBy || 'Gast'}</p>
          </div>
          {i === 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
              Läuft
            </span>
          )}
        </div>
      ))
    )}
  </div>
</div>

        {/* Unsichtbarer YouTube Player */}
        <div id="youtube-player" className="hidden"></div>
      </div>
    </div>
  );
};

export default SessionPage;
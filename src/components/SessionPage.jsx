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
  const timerRef = useRef(null);
  const hasInteracted = useRef(false); // Wichtig: Autoplay nur nach Interaktion

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
  const [volume, setVolume] = useState(50);
  const [isMutedForMe, setIsMutedForMe] = useState(() => localStorage.getItem(`mute_${sessionId}`) === 'true');
  const [showAudioPrompt, setShowAudioPrompt] = useState(true);

  // Voting
  const [votingRound, setVotingRound] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [votesCast, setVotesCast] = useState(0);

  const token = localStorage.getItem('token');
  const guestToken = localStorage.getItem('guestToken');
  const userId = localStorage.getItem('userId');

  const getAuthHeaders = () => {
    const headers = {};
    if (token && !guestToken) headers.Authorization = `Bearer ${token}`;
    else if (guestToken && !token) headers['x-guest-token'] = guestToken;
    return headers;
  };

  // === Load Data ===
  const loadSessionData = useCallback(async () => {
    try {
      const [sessRes, queueRes, propRes] = await Promise.all([
        axios.get(`http://localhost:4000/sessions/${sessionId}`, { headers: getAuthHeaders() }),
        axios.get(`http://localhost:4000/sessions/${sessionId}/queue`, { headers: getAuthHeaders() }),
        axios.get(`http://localhost:4000/sessions/${sessionId}/proposals`, { headers: getAuthHeaders() }),
      ]);

      setSession(sessRes.data);
      setQueue(queueRes.data);
      setProposals(propRes.data);
      setIsHost(sessRes.data.hostId == userId);

      // Auto-Start if queue not empty
      if (queueRes.data.length > 0 && !currentSong && hasInteracted.current) {
        const next = queueRes.data[0];
        setCurrentSong(next);
        playerRef.current?.loadVideoById(next.videoId);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) setShowGuestModal(true);
      else if (err.response?.status === 404) navigate('/dashboard');
    }
  }, [sessionId, userId, currentSong, navigate]);

  useEffect(() => {
    if (token || guestToken) {
      loadSessionData();
      const interval = setInterval(loadSessionData, 3000);
      return () => clearInterval(interval);
    }
  }, [loadSessionData, token, guestToken]);

  // === Socket Setup ===
  useEffect(() => {
    if (!token && !guestToken) return setShowGuestModal(true);

    socketRef.current = io(SOCKET_SERVER, {
      query: { sessionId },
      auth: token ? { token } : { guestToken },
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('request_participant_count');
    });

    socketRef.current.on('queue_updated', loadSessionData);
    socketRef.current.on('proposals_updated', loadSessionData);

    // === Voting Events ===
    socketRef.current.on('voting_started', (data) => {
      setVotingRound(data);
      setRemainingTime(60);
    });

    socketRef.current.on('voting_update', (data) => {
      setVotesCast(data.votesCast);
      setConnectedCount(data.connectedCount);
      setProposals(prev => prev.map(p => ({
        ...p,
        vote_count: data.proposalVotes[p.id] || 0
      })));
    });

    socketRef.current.on('voting_ended', () => {
      setVotingRound(null);
      setRemainingTime(0);
      loadSessionData();
    });

    socketRef.current.on('participant_count', setConnectedCount);

    // === Playback ===
    socketRef.current.on('playback_state', (state) => {
      if (!playerRef.current || !hasInteracted.current) return;

      if (!currentSong || currentSong.videoId !== state.current_video_id) {
        playerRef.current.loadVideoById(state.current_video_id, state.progress_seconds);
        setCurrentSong({ videoId: state.current_video_id });
      } else {
        const diff = Math.abs(playerRef.current.getCurrentTime() - state.progress_seconds);
        if (diff > 1.5) playerRef.current.seekTo(state.progress_seconds);
      }

      if (state.is_playing) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    });

    return () => socketRef.current.disconnect();
  }, [sessionId, token, guestToken, currentSong]);

  // === Countdown ===
  useEffect(() => {
    if (votingRound && remainingTime > 0) {
      timerRef.current = setTimeout(() => setRemainingTime(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [votingRound, remainingTime]);

  // === YouTube Player ===
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('youtube-player', {
        height: '1', width: '1', videoId: '',
        playerVars: { controls: 0, modestbranding: 1, fs: 0, rel: 0 },
        events: { onReady: () => playerRef.current.setVolume(isMutedForMe ? 0 : volume), onStateChange }
      });
    };
  }, []);

  const onStateChange = (e) => {
    if (e.data === window.YT.PlayerState.ENDED && isHost) {
      socketRef.current.emit('host_next');
    }

    if (isHost && playerRef.current) {
      const progress = playerRef.current.getCurrentTime() || 0;
      if (e.data === window.YT.PlayerState.PLAYING) {
        socketRef.current.emit('host_play', { videoId: currentSong?.videoId, progress });
      } else if (e.data === window.YT.PlayerState.PAUSED) {
        socketRef.current.emit('host_pause', progress);
      }
    }
  };

  // === Audio Enable (KRITISCH!) ===
  const enableAudio = () => {
    if (!playerRef.current) return;
    playerRef.current.playVideo();
    playerRef.current.pauseVideo();
    hasInteracted.current = true;
    setShowAudioPrompt(false);
    loadSessionData(); // Trigger playback if queue not empty
  };

  // === Host: Start Session / Play für alle ===
  const startSession = () => {
    if (!queue[0] || !hasInteracted.current) return;
    const video = queue[0];
    setCurrentSong(video);
    playerRef.current.loadVideoById(video.videoId);
    socketRef.current.emit('host_play', { videoId: video.videoId, progress: 0 });
  };

  // === Volume ===
  const handleVolumeChange = (e) => {
    const vol = parseInt(e.target.value);
    setVolume(vol);
    playerRef.current?.setVolume(isMutedForMe ? 0 : vol);
  };

  const togglePersonalMute = () => {
    const next = !isMutedForMe;
    setIsMutedForMe(next);
    localStorage.setItem(`mute_${sessionId}`, next);
    playerRef.current?.setVolume(next ? 0 : volume);
  };

  // === Search & Propose ===
  const searchYouTube = async () => {
    if (!searchQuery.trim()) return;
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', type: 'video', maxResults: 5, q: searchQuery, key: 'AIzaSyBYmLMpFyEjHVEvVhob4ncb9QYAse32kJo' },
    });
    setSearchResults(res.data.items);
  };

  const proposeSong = async (video) => {
    await axios.post(`http://localhost:4000/sessions/${sessionId}/proposals`, {
      videoId: video.id.videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails.medium.url
    }, { headers: getAuthHeaders() });
    setSearchResults([]);
    setSearchQuery('');
  };

  // === Vote (JETZT FUNKTIONIERT'S!) ===
  const vote = async (proposalId) => {
    try {
      await axios.post(`http://localhost:4000/sessions/${sessionId}/proposals/${proposalId}/vote`, {}, { headers: getAuthHeaders() });
      setUserVote(prev => ({ ...prev, [proposalId]: !prev[proposalId] }));
    } catch (err) {
      console.error("Vote failed:", err);
    }
  };

  // === Host: Direct Add / Start Voting ===
  const addToQueueDirectly = async (p) => {
    if (!isHost) return;
    await axios.post(`http://localhost:4000/sessions/${sessionId}/queue/add`, {
      videoId: p.videoId, title: p.title, thumbnail: p.thumbnail
    }, { headers: getAuthHeaders() });
    loadSessionData();
  };

  const startVoting = async () => {
    if (!isHost) return;
    await axios.post(`http://localhost:4000/sessions/${sessionId}/voting/start`, {}, { headers: getAuthHeaders() });
  };

  // === Guest Join ===
  const handleGuestJoin = async () => {
    if (!nickname.trim()) return;
    const res = await axios.post('http://localhost:4000/guest/join', { nickname });
    localStorage.setItem('guestToken', res.data.guestToken);
    setShowGuestModal(false);
    loadSessionData();
  };

  // === Guest Modal ===
  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-blue-700 mb-4">Willkommen!</h2>
          <input type="text" placeholder="Name" className="w-full border rounded p-3 mb-4" value={nickname} onChange={e => setNickname(e.target.value)} />
          <button onClick={handleGuestJoin} className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700">Beitreten</button>
        </div>
      </div>
    );
  }

  if (!session) return <div className="p-8 text-center">Lade Session...</div>;

  const quorumPercent = connectedCount > 0 ? (votesCast / connectedCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Audio Prompt */}
        {showAudioPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl text-center max-w-sm">
              <h3 className="text-xl font-bold mb-4">Ton aktivieren</h3>
              <p className="text-gray-600 mb-6">Klicke, um Audio zu erlauben</p>
              <button onClick={enableAudio} className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700">
                Audio aktivieren
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Session: {session.title}</h1>
          {token ? <button onClick={() => navigate('/dashboard')} className="text-gray-600">← Zurück</button> : <div>Gast: {nickname}</div>}
        </div>

        {/* Share */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex items-center justify-center gap-4">
          <QRCodeCanvas value={window.location.href} size={100} />
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link kopiert!'); }} className="text-blue-600 underline">
            {window.location.href}
          </button>
        </div>

        {/* Host: Start Session Button */}
        {isHost && queue.length > 0 && !currentSong && hasInteracted.current && (
          <div className="bg-green-600 text-white p-4 rounded-lg text-center mb-6 cursor-pointer" onClick={startSession}>
            <h3 className="text-xl font-bold">Session starten</h3>
            <p>Klicke, um für alle abz-spielen</p>
          </div>
        )}

        {/* Voting Panel */}
        {votingRound && (
          <div className="bg-purple-600 text-white p-4 rounded-lg mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-bold">Voting ({proposals.length}/10)</span>
              <span className="text-2xl">{remainingTime}s</span>
            </div>
            <div className="bg-white bg-opacity-30 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-green-400 transition-all" style={{ width: `${quorumPercent}%` }} />
            </div>
            <p className="text-sm mt-1">{votesCast}/{connectedCount} gevotet</p>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap items-center gap-3">
          <input type="range" min="0" max="100" value={volume} onChange={handleVolumeChange} className="flex-1 max-w-xs" />
          <span className="w-12 text-sm">{volume}%</span>
          <button onClick={togglePersonalMute} className={`px-3 py-1 rounded text-sm ${isMutedForMe ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>
            {isMutedForMe ? 'Stumm' : 'Ton'}
          </button>
          {isHost && !votingRound && proposals.length > 0 && (
            <button onClick={startVoting} className="ml-auto bg-purple-600 text-white px-4 py-1 rounded hover:bg-purple-700">
              Voting starten
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">Suche</h2>
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Song suchen" className="flex-1 border rounded p-2" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button onClick={searchYouTube} className="bg-green-600 text-white px-4 rounded hover:bg-green-700">Suchen</button>
          </div>
          {searchResults.map(v => (
            <div key={v.id.videoId} className="flex items-center gap-3 p-2 bg-gray-50 rounded mb-2">
              <img src={v.snippet.thumbnails.default.url} className="w-12 h-12 rounded" />
              <div className="flex-1 text-sm">{v.snippet.title}</div>
              <button onClick={() => proposeSong(v)} className="bg-blue-600 text-white px-2 rounded text-sm">Vorschlagen</button>
            </div>
          ))}
        </div>

        {/* Proposals */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">Vorschläge</h2>
          {proposals.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded mb-2">
              <img src={p.thumbnail} className="w-12 h-12 rounded" />
              <div className="flex-1">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-gray-500">Votes: {p.vote_count || 0}</p>
              </div>
              <button
                onClick={() => vote(p.id)}
                className={`px-3 py-1 rounded text-sm ${userVote[p.id] ? 'bg-red-500 text-white' : 'bg-yellow-500 text-white'} hover:opacity-80`}
              >
                {userVote[p.id] ? 'Entfernen' : 'Vote'}
              </button>
              {isHost && <button onClick={() => addToQueueDirectly(p)} className="bg-green-600 text-white px-2 rounded text-sm">Direkt</button>}
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Warteschlange</h2>
          {queue.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 p-2 border-b">
              <img src={s.thumbnail} className="w-12 h-12 rounded" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-gray-500">von {s.addedBy || 'Gast'}</p>
              </div>
              {i === 0 && <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Läuft</span>}
            </div>
          ))}
        </div>

        <div2 id="youtube-player" style={{ position: 'absolute', left: '-9999px' }}></div2>
      </div>
    </div>
  );
};

export default SessionPage;
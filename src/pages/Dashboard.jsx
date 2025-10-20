import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  // Get username from localStorage
  const username = localStorage.getItem('username');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl p-10 w-full max-w-md border border-gray-200 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Welcome, {username}!</h2>
        <p className="text-gray-600 mb-6">You are now logged in to TuneVote Dashboard.</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-6 rounded-lg shadow-md transition-colors duration-200"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

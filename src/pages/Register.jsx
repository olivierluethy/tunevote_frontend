import React, { useState } from 'react';
import axios from 'axios';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const res = await axios.post('http://localhost:4000/register', {
        username,
        email,
        password,
      });
      setMessage(res.data.message);
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err) {
      if (err.response) {
        setMessage(err.response.data.error);
      } else {
        setMessage('Server error');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-200 via-purple-100 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl p-10 w-full max-w-md border border-purple-100">
        <h2 className="text-3xl font-bold text-center text-purple-700 mb-2">Create Account</h2>
        <p className="text-center text-sm text-gray-500 mb-8">Join us and start your journey today</p>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:outline-none"
              placeholder="yourusername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              type="email"
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:outline-none"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-300 focus:outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700 transition-colors duration-200 text-white font-semibold py-2.5 rounded-lg shadow-md"
          >
            Register
          </button>
        </form>

        {message && <p className="mt-4 text-center text-sm text-red-500">{message}</p>}

        <p className="mt-6 text-sm text-center text-gray-500">
          Already have an account?{' '}
          <a href="/login" className="text-purple-600 font-medium hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

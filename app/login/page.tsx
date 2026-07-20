'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1e1e1e]">
      <div className="w-full max-w-sm rounded-lg border border-[#363636] bg-[#262626] p-8 shadow-xl">
        <h1 className="mb-1 text-center text-xl font-semibold text-[#dcddde]">
          kenshi2k personal notes
        </h1>
        <p className="mb-6 text-center text-sm text-[#8a8a8a]">
          Sign in to access your vault
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8a8a8a]">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#8a8a8a]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-[#363636] bg-[#1e1e1e] px-3 py-2 text-sm text-[#dcddde] outline-none focus:border-[#7f6df2]"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#7f6df2] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#6c5ce0] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

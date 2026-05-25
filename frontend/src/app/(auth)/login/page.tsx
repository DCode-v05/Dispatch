'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

function extractErrorMessage(err: unknown): string {
  const fallback = 'Login failed';
  if (!err || typeof err !== 'object') return fallback;
  const e = err as {
    response?: { data?: { message?: string | string[] }; status?: number };
    message?: string;
  };
  if (e.response?.status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  const msg = e.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return e.message || fallback;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.accessToken, data.user);
      router.push('/chat');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-(--ink)">
          Welcome back
        </h1>
        <p className="mt-2 text-(--ink-muted) text-sm">
          Sign in to pick up where you left off.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-(--danger-soft) border border-(--danger)/20 text-sm font-medium text-(--danger) flex items-start gap-2">
          <svg viewBox="0 0 24 24" className="h-4 w-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block font-mono text-[11px] uppercase tracking-wider font-medium text-(--ink-muted) mb-2">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input-field"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block font-mono text-[11px] uppercase tracking-wider font-medium text-(--ink-muted) mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="input-field"
            required
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 0 1 1.414 0l6 6a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414-1.414L14.586 11H3a1 1 0 1 1 0-2h11.586l-4.293-4.293a1 1 0 0 1 0-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </>
          )}
        </button>
      </form>

      <p className="text-center text-sm text-(--ink-muted) mt-8">
        Don&apos;t have an account?{' '}
        <Link
          href="/signup"
          className="text-(--accent) font-semibold hover:underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}

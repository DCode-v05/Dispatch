'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

function extractErrorMessage(err: unknown): string {
  const fallback = 'Registration failed';
  if (!err || typeof err !== 'object') return fallback;
  const e = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const msg = e.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return e.message || fallback;
}

export default function SignupPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { username, email, password });
      router.push('/login');
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
          Create your account
        </h1>
        <p className="mt-2 text-(--ink-muted) text-sm">
          Start chatting in under a minute.
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
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
            className="input-field"
            required
            minLength={3}
            maxLength={32}
            pattern="[a-zA-Z0-9_.\-]+"
            title="letters, numbers, _ . - only"
            autoComplete="username"
          />
          <p className="text-[11px] text-(--ink-subtle) mt-1.5 font-medium">
            3–32 chars. Letters, numbers, <span className="font-mono">_</span>{' '}
            <span className="font-mono">.</span> <span className="font-mono">-</span>
          </p>
        </div>

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
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-(--ink-subtle) mt-1.5 font-medium">
            8+ chars with an uppercase, lowercase, and digit.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3 text-sm"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>

      <p className="text-center text-sm text-(--ink-muted) mt-8">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-(--accent) font-semibold hover:underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

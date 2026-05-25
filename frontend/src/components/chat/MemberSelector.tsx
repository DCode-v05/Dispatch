'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Avatar from '@/components/ui/Avatar';

interface User {
  id: string;
  username: string;
  email: string;
}

interface MemberSelectorProps {
  selectedUsers: User[];
  onChange: (users: User[]) => void;
  placeholder?: string;
  excludeUserIds?: string[];
  onlyIds?: string[];
}

export default function MemberSelector({
  selectedUsers,
  onChange,
  placeholder = 'Search users by name or email…',
  excludeUserIds = [],
  onlyIds,
}: MemberSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const { data } = await api.get(`/users?q=${encodeURIComponent(query)}`);
        setResults(
          data.filter(
            (u: User) =>
              !selectedUsers.find((s) => s.id === u.id) &&
              !excludeUserIds.includes(u.id) &&
              (!onlyIds || onlyIds.includes(u.id)),
          ),
        );
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [query, selectedUsers, excludeUserIds, onlyIds]);

  const addUser = (user: User) => {
    onChange([...selectedUsers, user]);
    setQuery('');
    setResults([]);
  };

  const removeUser = (userId: string) => {
    onChange(selectedUsers.filter((u) => u.id !== userId));
  };

  return (
    <div className="space-y-3">
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 bg-(--accent-soft) text-(--accent) px-2.5 py-1.5 rounded-full text-sm font-semibold animate-fade-in-up"
            >
              <Avatar name={user.username} size="xs" />
              <span>{user.username}</span>
              <button
                type="button"
                onClick={() => removeUser(user.id)}
                className="opacity-70 hover:opacity-100 ml-0.5 p-0.5 rounded-full"
                aria-label={`Remove ${user.username}`}
              >
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="input-field pl-11"
        />
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--ink-subtle)">
          {loading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>

        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-(--surface) border border-(--line) rounded-xl shadow-pop z-50 max-h-60 overflow-y-auto animate-fade-in-up">
            {results.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => addUser(user)}
                className="w-full flex items-center gap-3 p-3 hover:bg-(--line-soft) text-left transition-colors border-b border-(--line-soft) last:border-0"
              >
                <Avatar name={user.username} size="sm" userId={user.id} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--ink) truncate">
                    {user.username}
                  </p>
                  <p className="text-xs text-(--ink-muted) truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-(--surface) border border-(--line) rounded-xl shadow-soft z-50 p-5 text-center">
            <p className="text-sm text-(--ink-muted)">
              No users found matching &quot;<span className="font-semibold text-(--ink)">{query}</span>&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

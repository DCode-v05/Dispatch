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
  placeholder = "Search users by name or email...",
  excludeUserIds = [],
  onlyIds
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
        setResults(data.filter((u: User) => 
          !selectedUsers.find(s => s.id === u.id) && 
          !excludeUserIds.includes(u.id) &&
          (!onlyIds || onlyIds.includes(u.id))
        ));
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
    onChange(selectedUsers.filter(u => u.id !== userId));
  };

  return (
    <div className="space-y-4">
      {/* Selected Members Chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedUsers.map(user => (
            <div key={user.id} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full border border-indigo-100 text-sm font-medium">
              <Avatar name={user.username} size="sm" />
              <span>{user.username}</span>
              <button 
                type="button"
                onClick={() => removeUser(user.id)}
                className="hover:text-indigo-900 ml-1 p-0.5 rounded-full hover:bg-indigo-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
          />
          <div className="absolute left-4 top-3.5 text-slate-400">
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
        </div>

        {/* Results Dropdown */}
        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
            {results.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => addUser(user)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
              >
                <Avatar name={user.username} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{user.username}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-6 text-center">
            <p className="text-sm text-slate-500">No users found matching &quot;{query}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
}

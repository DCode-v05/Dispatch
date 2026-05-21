'use client';

import { getInitials } from '@/lib/utils';
import { usePresenceStore } from '@/stores/presenceStore';

interface AvatarProps {
  name: string;
  userId?: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'w-10 h-10 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-xl',
};

export default function Avatar({ name, userId, size = 'md', showStatus = false, className = '' }: AvatarProps) {
  const isOnline = usePresenceStore((s) => (userId ? s.isOnline(userId) : false));

  return (
    <div className={`relative inline-flex group ${className}`}>
      <div
        className={`${sizeMap[size]} bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-bold shadow-sm ring-2 ring-white group-hover:scale-105 transition-transform duration-200 ease-out`}
      >
        {getInitials(name)}
      </div>
      {showStatus && userId && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        />
      )}
    </div>
  );
}

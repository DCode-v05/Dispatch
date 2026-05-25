'use client';

import { getInitials } from '@/lib/utils';
import { usePresenceStore } from '@/stores/presenceStore';

interface AvatarProps {
  name: string;
  userId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  isGroup?: boolean;
  className?: string;
}

const sizeMap = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
};

const statusSize = {
  xs: 'h-2 w-2 -bottom-px -right-px',
  sm: 'h-2.5 w-2.5 -bottom-px -right-px',
  md: 'h-3 w-3 -bottom-0.5 -right-0.5',
  lg: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5',
  xl: 'h-4 w-4 -bottom-0.5 -right-0.5',
};

/**
 * Map a string → deterministic hue (0..360) so each user gets a stable color.
 * Two-tone gradients are built from this hue.
 */
function hueFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export default function Avatar({
  name,
  userId,
  size = 'md',
  showStatus = false,
  isGroup = false,
  className = '',
}: AvatarProps) {
  const isOnline = usePresenceStore((s) => (userId ? s.isOnline(userId) : false));
  const initials = getInitials(name || '?');
  const hue = hueFromString(userId || name || '?');

  const gradient = isGroup
    ? `linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 70%, var(--ink)))`
    : `linear-gradient(135deg, oklch(72% 0.14 ${hue}), oklch(60% 0.18 ${(hue + 30) % 360}))`;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-2xl flex items-center justify-center font-display font-bold text-white shadow-soft tracking-tight select-none`}
        style={{ background: gradient }}
      >
        {isGroup ? (
          <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M16 3.13a4 4 0 010 7.75M8 3.13a4 4 0 000 7.75M12 14a4 4 0 100-8 4 4 0 000 8z" />
          </svg>
        ) : (
          initials
        )}
      </div>
      {showStatus && userId && (
        <span
          className={`absolute ${statusSize[size]} rounded-full ring-2 ring-(--surface) ${
            isOnline ? 'bg-(--positive)' : 'bg-(--ink-subtle)'
          }`}
          aria-label={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}

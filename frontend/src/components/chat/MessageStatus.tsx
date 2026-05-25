'use client';

import type { MessageDeliveryStatus } from '@/types';

interface MessageStatusProps {
  status: MessageDeliveryStatus;
  isOwn: boolean;
}

/**
 * Pending → Sent → Delivered → Seen
 *   pending   = clock icon
 *   sent      = single check
 *   delivered = double check (dimmed)
 *   seen      = double check (accent color)
 */
export default function MessageStatus({ status, isOwn }: MessageStatusProps) {
  if (!isOwn) return null;

  if (status === 'pending') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 opacity-70"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-label="Sending"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2 1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (status === 'sent') {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-label="Sent">
        <path d="M11.94 4.06a.75.75 0 0 1 .12 1.05l-5 6.5a.75.75 0 0 1-1.12.07L3.22 8.96a.75.75 0 1 1 1.06-1.06l2.13 2.13 4.48-5.83a.75.75 0 0 1 1.05-.14z" />
      </svg>
    );
  }

  // delivered / seen — double check
  const isSeen = status === 'seen';
  return (
    <svg
      viewBox="0 0 20 16"
      className={`h-3.5 w-4 transition-colors duration-200 ${isSeen ? 'text-(--positive)' : ''}`}
      fill="currentColor"
      aria-label={isSeen ? 'Seen' : 'Delivered'}
    >
      <path d="M7.94 3.06a.75.75 0 0 1 .12 1.05l-4.5 6.5a.75.75 0 0 1-1.12.07L.22 8.96a.75.75 0 1 1 1.06-1.06l1.63 1.62 3.99-5.32a.75.75 0 0 1 1.04-.14z" />
      <path d="M15.94 3.06a.75.75 0 0 1 .12 1.05l-5 6.5a.75.75 0 0 1-1.12.07L7.22 7.96a.75.75 0 1 1 1.06-1.06l2.13 2.13 4.48-5.83a.75.75 0 0 1 1.05-.14z" />
    </svg>
  );
}

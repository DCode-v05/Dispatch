'use client';

import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';

interface TypingIndicatorProps {
  roomId: string;
}

const EMPTY_USERS: string[] = [];

export default function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const typingUsers = useChatStore((s) => s.typingUsers[roomId] || EMPTY_USERS);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const othersTyping = typingUsers.filter((id) => id !== currentUserId);
  if (othersTyping.length === 0) return null;

  const label =
    othersTyping.length === 1
      ? 'typing'
      : `${othersTyping.length} people typing`;

  return (
    <div className="px-2 mb-2 flex items-center gap-2 text-xs text-(--ink-muted) animate-fade-in-up">
      <div className="flex gap-1 items-end h-3.5">
        <span
          className="block h-1.5 w-1.5 rounded-full bg-(--accent) animate-bounce-soft"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="block h-1.5 w-1.5 rounded-full bg-(--accent) animate-bounce-soft"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="block h-1.5 w-1.5 rounded-full bg-(--accent) animate-bounce-soft"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span className="font-medium">{label}…</span>
    </div>
  );
}

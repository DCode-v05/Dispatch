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

  return (
    <div className="px-4 py-1 text-xs text-gray-500 italic">
      {othersTyping.length === 1
        ? 'Someone is typing...'
        : `${othersTyping.length} people are typing...`}
    </div>
  );
}

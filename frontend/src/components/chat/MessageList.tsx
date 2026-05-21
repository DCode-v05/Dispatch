'use client';

import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { Message } from '@/types';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  roomId: string;
}

const EMPTY_MESSAGES: Message[] = [];

export default function MessageList({ roomId }: MessageListProps) {
  const messages = useChatStore((s) => s.messages[roomId] || EMPTY_MESSAGES);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  return (
    <div className="flex-1 p-4 space-y-2 relative">
      <div className="relative z-10 flex flex-col min-h-full">
        <div className="flex-1"></div>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 mb-auto">
            <div className="bg-white/80 px-4 py-2 rounded-lg text-xs font-medium text-gray-500 shadow-sm">
              MESSAGES ARE END-TO-END ENCRYPTED
            </div>
            <p className="text-center text-gray-500 mt-8 text-sm">No messages yet. Start the conversation!</p>
          </div>
        )}
        <div className="space-y-1">
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id || msg._id || `${msg.timestamp}-${index}`}
              message={msg}
              isOwn={msg.senderId === user?.id}
            />
          ))}
        </div>
        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}

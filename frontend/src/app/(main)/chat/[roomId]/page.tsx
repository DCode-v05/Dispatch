'use client';

import { use, useEffect } from 'react';
import { Message } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { getChatSocket } from '@/lib/socket';
import api from '@/lib/api';
import ChatWindow from '@/components/chat/ChatWindow';

export default function ChatRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = use(params);
  const roomId = resolvedParams?.roomId;
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);
  const setMessages = useChatStore((s) => s.setMessages);

  useEffect(() => {
    if (!roomId) return;

    setActiveRoom(roomId);

    const socket = getChatSocket();
    socket.emit('join_room', { roomId });

    const hasHistory = !!useChatStore.getState().messages[roomId];

    if (!hasHistory) {
      api
        .get(`/messages/${roomId}`)
        .then(({ data }) => {
          setMessages(
            roomId,
            data.map((m: Message) => ({ ...m, id: m._id || m.id })),
          );
          api.patch(`/messages/room/${roomId}/read`).catch(console.error);
        })
        .catch(console.error);
    } else {
      api.patch(`/messages/room/${roomId}/read`).catch(console.error);
    }

    return () => {
      socket.emit('leave_room', { roomId });
      setActiveRoom(null);
    };
  }, [roomId, setActiveRoom, setMessages]);

  if (!roomId) {
    return (
      <div className="flex-1 flex items-center justify-center text-(--ink-muted)">
        Loading chat…
      </div>
    );
  }

  return <ChatWindow roomId={roomId} />;
}

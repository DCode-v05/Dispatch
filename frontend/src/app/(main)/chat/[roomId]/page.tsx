'use client';

import { use, useEffect } from 'react';
import { Message } from '@/types';
import { useChatStore } from '@/stores/chatStore';
import { getChatSocket } from '@/lib/socket';
import api from '@/lib/api';
import ChatWindow from '@/components/chat/ChatWindow';

export default function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const resolvedParams = use(params);
  const roomId = resolvedParams?.roomId;
  
  const { setActiveRoom, setMessages, messages } = useChatStore();

  useEffect(() => {
    if (!roomId) return;
    
    setActiveRoom(roomId);

    // Join room via socket
    const socket = getChatSocket();
    socket.emit('join_room', { roomId });

    // Fetch message history
    if (!messages[roomId]) {
      api.get(`/messages/${roomId}`).then(({ data }) => {
        setMessages(roomId, data.map((m: Message) => ({ ...m, id: m._id || m.id })));
        // Mark as read after fetching
        api.patch(`/messages/room/${roomId}/read`).catch(console.error);
      }).catch(console.error);
    } else {
      // Room already loaded, still mark new messages as read
      api.patch(`/messages/room/${roomId}/read`).catch(console.error);
    }

    return () => {
      socket.emit('leave_room', { roomId });
      setActiveRoom(null);
    };
  }, [roomId, setActiveRoom, setMessages, messages]);

  if (!roomId) {
    return <div className="flex-1 flex items-center justify-center">Loading chat...</div>;
  }

  return <ChatWindow roomId={roomId} />;
}

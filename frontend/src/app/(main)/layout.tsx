'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { getChatSocket, getPresenceSocket, getNotificationSocket, disconnectAll } from '@/lib/socket';
import api from '@/lib/api';
import Sidebar from '@/components/layout/Sidebar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const { setRooms, addMessage, setInvitations } = useChatStore();
  const { setUserOnline, setUserOffline } = usePresenceStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch rooms and invitations
    api.get('/rooms').then(({ data }) => setRooms(data)).catch(console.error);
    api.get('/invitations').then(({ data }) => setInvitations(data)).catch(console.error);

    // Connect sockets
    const chat = getChatSocket();
    const presence = getPresenceSocket();
    const notifications = getNotificationSocket();

    chat.connect();
    presence.connect();
    notifications.connect();

    chat.on('new_message', (msg) => {
      addMessage(msg.roomId, { ...msg, id: msg.messageId || msg._id || msg.id });
    });

    chat.on('room_created', () => {
      api.get('/rooms').then(({ data }) => setRooms(data)).catch(console.error);
      api.get('/invitations').then(({ data }) => setInvitations(data)).catch(console.error);
    });

    chat.on('messages_read', ({ roomId, userId }) => {
      // We'll add this action to chatStore
      useChatStore.getState().markMessagesAsRead(roomId, userId);
    });

    presence.on('presence_update', (data: { userId: string; isOnline: boolean }) => {
      if (data.isOnline) setUserOnline(data.userId);
      else setUserOffline(data.userId);
    });

    return () => {
      disconnectAll();
    };
  }, [isAuthenticated, setRooms, addMessage, setUserOnline, setUserOffline, setInvitations]);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed md:static inset-y-0 left-0 z-50 w-72 transform transition-transform md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center p-3 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-2 font-semibold">ChatPlatform</span>
        </div>
        {children}
      </div>
    </div>
  );
}

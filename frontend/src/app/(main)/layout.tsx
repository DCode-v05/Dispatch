'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { usePresenceStore } from '@/stores/presenceStore';
import {
  disconnectAll,
  getChatSocket,
  getNotificationSocket,
  getPresenceSocket,
} from '@/lib/socket';
import api from '@/lib/api';
import Sidebar from '@/components/layout/Sidebar';
import { toast } from '@/stores/toastStore';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const { setRooms, addMessage, setInvitations } = useChatStore();
  const { setUserOnline, setUserOffline } = usePresenceStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    api
      .get('/rooms')
      .then(({ data }) => setRooms(data))
      .catch(console.error);
    api
      .get('/invitations')
      .then(({ data }) => setInvitations(data))
      .catch(console.error);

    const chat = getChatSocket();
    const presence = getPresenceSocket();
    const notifications = getNotificationSocket();

    chat.connect();
    presence.connect();
    notifications.connect();

    chat.on('new_message', (msg) => {
      const normalized = { ...msg, id: msg.messageId || msg._id || msg.id };
      addMessage(normalized.roomId, normalized, {
        fromSelf: normalized.senderId === user?.id,
      });
    });

    chat.on('room_created', () => {
      api
        .get('/rooms')
        .then(({ data }) => setRooms(data))
        .catch(console.error);
      api
        .get('/invitations')
        .then(({ data }) => setInvitations(data))
        .catch(console.error);
    });

    chat.on('messages_read', ({ roomId, userId }) => {
      useChatStore.getState().markMessagesAsRead(roomId, userId);
    });

    presence.on(
      'presence_update',
      (data: { userId: string; isOnline: boolean }) => {
        if (data.isOnline) setUserOnline(data.userId);
        else setUserOffline(data.userId);
      },
    );

    notifications.on('notification', (n: { type?: string; message?: string }) => {
      if (n?.type === 'new_message') return; // already surfaced via the chat tab
      if (n?.message) toast.info('New notification', n.message);
    });

    return () => {
      disconnectAll();
    };
  }, [
    isAuthenticated,
    user?.id,
    setRooms,
    addMessage,
    setUserOnline,
    setUserOffline,
    setInvitations,
  ]);

  return (
    <div className="h-screen flex overflow-hidden bg-(--canvas) text-(--ink)">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'var(--overlay)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed md:static inset-y-0 left-0 z-50 w-75 transform transition-transform md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile header */}
        <div className="md:hidden flex items-center px-3 py-2 border-b border-(--line) bg-(--surface) gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="btn-ghost h-9 w-9"
            aria-label="Open sidebar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display font-bold tracking-tight text-(--ink)">
            Dispatch
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

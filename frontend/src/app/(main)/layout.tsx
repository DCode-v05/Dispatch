'use client';

import { useEffect, useRef, useState } from 'react';
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
import { playPing, unlockAudioOnFirstInteraction } from '@/lib/sound';
import type { Invitation, Room } from '@/types';

interface IncomingMessage {
  messageId?: string;
  _id?: string;
  id?: string;
  roomId: string;
  senderId: string;
  content: string;
  timestamp?: string;
  createdAt?: string;
  readBy?: string[];
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();
  const { setRooms, addMessage, setInvitations } = useChatStore();
  const { setUserOnline, setUserOffline, setOnlineUsers } = usePresenceStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const windowFocusedRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cleanup = unlockAudioOnFirstInteraction();
    const onFocus = () => {
      windowFocusedRef.current = true;
    };
    const onBlur = () => {
      windowFocusedRef.current = false;
    };
    windowFocusedRef.current = document.hasFocus();
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      cleanup();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    /** Refetch rooms+invitations and re-seed presence — used on initial mount AND on socket reconnect. */
    const refreshState = async () => {
      try {
        const [{ data: rooms }, { data: invitations }] = await Promise.all([
          api.get<Room[]>('/rooms'),
          api.get('/invitations'),
        ]);
        setRooms(rooms);
        setInvitations(invitations);

        // Collect every participant id (excluding self) and seed presence
        const participantIds = new Set<string>();
        for (const r of rooms ?? []) {
          for (const p of r.participants ?? []) {
            if (p && p !== user?.id) participantIds.add(p);
          }
        }
        if (participantIds.size > 0) {
          try {
            const ids = Array.from(participantIds).join(',');
            const { data } = await api.get<
              Record<string, { isOnline: boolean }>
            >(`/presence?ids=${encodeURIComponent(ids)}`);
            const online: string[] = [];
            for (const [id, status] of Object.entries(data ?? {})) {
              if (status?.isOnline) online.push(id);
            }
            setOnlineUsers(online);
          } catch (err) {
            console.warn('presence seed failed', err);
          }
        }
      } catch (err) {
        console.error('failed to refresh state', err);
      }
    };

    void refreshState();

    const chat = getChatSocket();
    const presence = getPresenceSocket();
    const notifications = getNotificationSocket();

    chat.connect();
    presence.connect();
    notifications.connect();

    const onNewMessage = (msg: IncomingMessage) => {
      const normalized = {
        ...msg,
        id: msg.messageId || msg._id || msg.id || `m_${Date.now()}`,
        type: 'text' as const,
        readBy: msg.readBy ?? [msg.senderId],
        timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
      };
      const fromSelf = normalized.senderId === user?.id;
      addMessage(normalized.roomId, normalized, { fromSelf });

      // Ping on inbound messages when room not actively visible
      if (!fromSelf) {
        const activeRoom = useChatStore.getState().activeRoomId;
        const inActive = String(activeRoom) === String(normalized.roomId);
        if (!inActive || !windowFocusedRef.current) {
          playPing();
        }
      }
    };

    const onRoomCreated = () => {
      void refreshState();
    };

    const onMessagesRead = ({ roomId, userId }: { roomId: string; userId: string }) => {
      useChatStore.getState().markMessagesAsRead(roomId, userId);
    };

    const onMessageDeleted = ({
      roomId,
      messageId,
    }: {
      roomId: string;
      messageId: string;
    }) => {
      useChatStore.getState().removeMessage(roomId, messageId);
    };

    const onRoomDeleted = ({ roomId }: { roomId: string }) => {
      const wasActive =
        String(useChatStore.getState().activeRoomId) === String(roomId);
      useChatStore.getState().removeRoom(roomId);
      if (wasActive) {
        toast.info('Room deleted', 'The room you were viewing was removed.');
      }
    };

    const onParticipantsChanged = ({
      roomId,
      participants,
    }: {
      roomId: string;
      participants: string[];
      addedUserIds?: string[];
      removedUserIds?: string[];
    }) => {
      useChatStore.getState().patchRoomParticipants(roomId, participants);
    };

    const onInvitationReceived = (invite: Invitation) => {
      useChatStore.getState().upsertInvitation(invite);
      toast.info('New invitation', `${invite.senderUsername || invite.senderEmail} invited you to chat.`);
      playPing();
    };

    const onInvitationRejected = ({
      invitationId,
    }: {
      invitationId: string;
    }) => {
      useChatStore.getState().removeInvitation(invitationId);
      toast.info('Invitation declined', 'Your invitation was declined.');
    };

    const onUserTyping = ({
      roomId,
      userId,
    }: {
      roomId: string;
      userId: string;
    }) => {
      if (userId === user?.id) return;
      useChatStore.getState().markUserTyping(roomId, userId);
    };

    const onPresenceUpdate = (data: { userId: string; isOnline: boolean }) => {
      if (data.isOnline) setUserOnline(data.userId);
      else setUserOffline(data.userId);
    };

    const onNotification = (n: { type?: string; message?: string }) => {
      if (n?.type === 'new_message') return; // already surfaced via chat
      if (n?.message) {
        toast.info('New notification', n.message);
        playPing();
      }
    };

    const onChatReconnect = () => {
      console.info('[chat] reconnected — refreshing state');
      void refreshState();
    };
    const onPresenceReconnect = () => {
      console.info('[presence] reconnected — re-seeding online users');
      void refreshState();
    };

    chat.on('new_message', onNewMessage);
    chat.on('room_created', onRoomCreated);
    chat.on('messages_read', onMessagesRead);
    chat.on('message_deleted', onMessageDeleted);
    chat.on('room_deleted', onRoomDeleted);
    chat.on('participants_changed', onParticipantsChanged);
    chat.on('invitation_received', onInvitationReceived);
    chat.on('invitation_rejected', onInvitationRejected);
    chat.on('user_typing', onUserTyping);
    chat.io.on('reconnect', onChatReconnect);

    presence.on('presence_update', onPresenceUpdate);
    presence.io.on('reconnect', onPresenceReconnect);

    notifications.on('notification', onNotification);

    return () => {
      chat.off('new_message', onNewMessage);
      chat.off('room_created', onRoomCreated);
      chat.off('messages_read', onMessagesRead);
      chat.off('message_deleted', onMessageDeleted);
      chat.off('room_deleted', onRoomDeleted);
      chat.off('participants_changed', onParticipantsChanged);
      chat.off('invitation_received', onInvitationReceived);
      chat.off('invitation_rejected', onInvitationRejected);
      chat.off('user_typing', onUserTyping);
      chat.io.off('reconnect', onChatReconnect);
      presence.off('presence_update', onPresenceUpdate);
      presence.io.off('reconnect', onPresenceReconnect);
      notifications.off('notification', onNotification);
      disconnectAll();
    };
  }, [
    isAuthenticated,
    user?.id,
    setRooms,
    addMessage,
    setUserOnline,
    setUserOffline,
    setOnlineUsers,
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

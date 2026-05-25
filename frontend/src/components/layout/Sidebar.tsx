'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { Room } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { formatRelative, truncate } from '@/lib/utils';
import { toast } from '@/stores/toastStore';
import api from '@/lib/api';

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const {
    rooms,
    activeRoomId,
    invitations,
    setInvitations,
    upsertRoom,
    messages,
    unread,
  } = useChatStore();
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [query, setQuery] = useState('');

  const getRoomDisplayName = (room: Room) => {
    if (room.type === 'direct' && room.participantNames) {
      const otherId = room.participants.find((id) => id !== user?.id);
      if (otherId && room.participantNames[otherId]) {
        return room.participantNames[otherId];
      }
    }
    return room.name;
  };

  const lastMessageFor = (room: Room) => {
    const id = String(room._id || room.id);
    const stream = messages[id];
    if (stream && stream.length > 0) {
      const last = stream[stream.length - 1];
      const isMine = last.senderId === user?.id;
      const senderLabel = isMine
        ? 'You'
        : room.participantNames?.[last.senderId] ?? '';
      const prefix = room.type === 'group' && senderLabel ? `${senderLabel}: ` : isMine ? 'You: ' : '';
      return {
        text: prefix + last.content,
        at: last.timestamp || last.createdAt,
      };
    }
    if (room.lastMessageContent) {
      const isMine = room.lastMessageSenderId === user?.id;
      const senderLabel =
        isMine
          ? 'You'
          : room.lastMessageSenderId
            ? (room.participantNames?.[room.lastMessageSenderId] ?? '')
            : '';
      const prefix = room.type === 'group' && senderLabel ? `${senderLabel}: ` : isMine ? 'You: ' : '';
      return {
        text: prefix + room.lastMessageContent,
        at: room.lastMessageAt,
      };
    }
    return null;
  };

  const filterRooms = (list: Room[]) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((r) => {
      const name = getRoomDisplayName(r).toLowerCase();
      if (name.includes(q)) return true;
      const last = lastMessageFor(r);
      return last?.text.toLowerCase().includes(q);
    });
  };

  const sortByActivity = (list: Room[]) =>
    [...list].sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });

  const directChats = useMemo(
    () => sortByActivity(filterRooms(rooms.filter((r) => r.type === 'direct'))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooms, query, user?.id, messages],
  );
  const groupChats = useMemo(
    () => sortByActivity(filterRooms(rooms.filter((r) => r.type === 'group'))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rooms, query, user?.id, messages],
  );

  const navigateTo = (path: string) => {
    router.push(path);
    onClose();
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      await api.post('/invitations', { email: inviteEmail });
      setInviteEmail('');
      setShowInviteModal(false);
      toast.success('Invitation sent', `${inviteEmail} will see it on next login.`);
    } catch (err) {
      console.error(err);
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error('Could not send invitation', typeof msg === 'string' ? msg : undefined);
    } finally {
      setIsInviting(false);
    }
  };

  const handleAcceptInvite = async (id: string) => {
    try {
      const { data: newRoom } = await api.post(`/invitations/${id}/accept`);
      setInvitations(invitations.filter((i) => i._id !== id));
      upsertRoom(newRoom);
      navigateTo(`/chat/${newRoom._id || newRoom.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Could not accept invitation');
    }
  };

  const handleRejectInvite = async (id: string) => {
    try {
      await api.post(`/invitations/${id}/reject`);
      setInvitations(invitations.filter((i) => i._id !== id));
      toast.info('Invitation declined');
    } catch (err) {
      console.error(err);
      toast.error('Could not decline invitation');
    }
  };

  const renderRoomButton = (room: Room) => {
    const id = String(room._id || room.id);
    const isActive = String(activeRoomId) === id;
    const last = lastMessageFor(room);
    const unreadCount = unread[id] ?? 0;
    const otherId =
      room.type === 'direct'
        ? room.participants.find((p) => p !== user?.id)
        : undefined;

    return (
      <button
        key={id}
        onClick={() => navigateTo(`/chat/${id}`)}
        className={`w-full text-left px-3 py-3 flex items-center gap-3 rounded-xl transition relative group ${
          isActive
            ? 'bg-(--accent-soft)'
            : 'hover:bg-(--line-soft)'
        }`}
      >
        {isActive && (
          <span className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full bg-(--accent)" />
        )}
        {room.type === 'direct' ? (
          <Avatar
            name={getRoomDisplayName(room)}
            userId={otherId}
            size="md"
            showStatus
          />
        ) : (
          <Avatar name={room.name} size="md" isGroup />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <h3
              className={`text-sm font-semibold truncate ${
                isActive ? 'text-(--ink)' : 'text-(--ink)'
              }`}
            >
              {getRoomDisplayName(room)}
            </h3>
            <span className="font-mono text-[10px] uppercase tracking-wider text-(--ink-subtle) shrink-0">
              {last?.at ? formatRelative(last.at) : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p
              className={`text-xs truncate flex-1 ${
                unreadCount > 0
                  ? 'font-semibold text-(--ink)'
                  : 'text-(--ink-muted)'
              }`}
            >
              {last
                ? truncate(last.text, 50)
                : room.type === 'group'
                  ? `${room.participants.length} member${room.participants.length === 1 ? '' : 's'}`
                  : 'No messages yet'}
            </p>
            {unreadCount > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full bg-(--accent) text-(--accent-ink)">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="h-full bg-(--surface) border-r border-(--line) flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-(--line-soft) flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-(--accent) flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-(--accent-ink)" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold tracking-tight text-(--ink) truncate">
              Dispatch
            </h1>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-(--ink-subtle) leading-none mt-0.5">
              v1.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button
            onClick={() => setShowInviteModal(true)}
            className="btn-ghost h-9 w-9"
            title="Invite someone"
            aria-label="Invite person"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <button
            onClick={() => navigateTo('/rooms')}
            className="btn-ghost h-9 w-9"
            title="New group chat"
            aria-label="Create group"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-(--line-soft) border-0 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-(--ink) placeholder:text-(--ink-subtle) focus:bg-(--surface) focus:ring-2 focus:ring-(--accent)/30 outline-none transition"
          />
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-(--ink-subtle)"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {invitations.length > 0 && (
          <div className="mt-2 mb-3">
            <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-(--ink-subtle)">
              Pending · {invitations.length}
            </p>
            {invitations.map((invite) => (
              <div
                key={invite._id}
                className="px-3 py-3 mx-1 rounded-xl bg-(--accent-soft) border border-(--accent)/15 flex items-center justify-between gap-2 mb-1.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={invite.senderUsername || invite.senderEmail} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--ink) truncate">
                      {invite.senderUsername || invite.senderEmail}
                    </p>
                    <p className="text-[11px] text-(--ink-muted) truncate">
                      Sent you an invitation
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleAcceptInvite(invite._id)}
                    className="h-8 w-8 rounded-lg bg-(--accent) text-(--accent-ink) flex items-center justify-center hover:bg-(--accent-hover) transition"
                    title="Accept"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRejectInvite(invite._id)}
                    className="h-8 w-8 rounded-lg bg-(--line-soft) text-(--ink-muted) hover:bg-(--line) hover:text-(--ink) flex items-center justify-center transition"
                    title="Decline"
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {directChats.length > 0 && (
          <>
            <p className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-(--ink-subtle)">
              Direct Messages    
            </p>
            {directChats.map(renderRoomButton)}
          </>
        )}

        {groupChats.length > 0 && (
          <>
            <p className="px-3 pt-4 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-(--ink-subtle)">
              Groups
            </p>
            {groupChats.map(renderRoomButton)}
          </>
        )}

        {directChats.length === 0 && groupChats.length === 0 && (
          <div className="text-center py-10 px-6">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-(--line-soft) text-(--ink-muted) flex items-center justify-center mb-3">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-(--ink)">
              {query ? 'No matches' : 'Nothing here yet'}
            </p>
            <p className="text-xs text-(--ink-muted) mt-1">
              {query
                ? 'Try a different search term.'
                : 'Invite someone or start a group above.'}
            </p>
          </div>
        )}
      </div>

      {/* User footer */}
      <div className="p-3 border-t border-(--line-soft) flex items-center gap-2">
        <button
          onClick={() => navigateTo('/settings')}
          className="flex-1 flex items-center gap-3 p-2 hover:bg-(--line-soft) rounded-xl transition text-left min-w-0"
        >
          <Avatar
            name={user?.username || '?'}
            userId={user?.id}
            size="sm"
            showStatus
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-(--ink) truncate">
              {user?.username ?? 'You'}
            </p>
            <p className="text-[11px] text-(--ink-subtle) truncate lowercase">
              {user?.email}
            </p>
          </div>
        </button>
        <button
          onClick={() => setShowLogoutModal(true)}
          className="btn-ghost h-9 w-9 text-(--ink-subtle) hover:text-(--danger) hover:bg-(--danger-soft)"
          title="Log out"
          aria-label="Log out"
        >
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Invite modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite someone"
        description="They'll see your invitation the next time they sign in."
      >
        <form onSubmit={handleSendInvite} className="space-y-5">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider font-medium text-(--ink-muted) mb-2">
              Email address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="friend@example.com"
              required
              className="input-field"
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isInviting}
              className="btn-primary flex-1"
            >
              {isInviting ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send invitation'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Logout modal */}
      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Log out?"
        description="You'll need to sign in again to access your messages."
        size="sm"
      >
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => setShowLogoutModal(false)}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setShowLogoutModal(false);
              logout();
              router.push('/login');
            }}
            className="btn-primary flex-1"
            style={{ background: 'var(--danger)' }}
          >
            Log out
          </button>
        </div>
      </Modal>
    </div>
  );
}

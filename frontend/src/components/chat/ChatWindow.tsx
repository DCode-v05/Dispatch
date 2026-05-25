'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { Room } from '@/types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import MemberSelector from './MemberSelector';
import { toast } from '@/stores/toastStore';
import api from '@/lib/api';

interface User {
  id: string;
  username: string;
  email: string;
}

interface ChatWindowProps {
  roomId: string;
}

export default function ChatWindow({ roomId }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { rooms, setRooms } = useChatStore();
  const router = useRouter();
  const room = rooms.find((r) => String(r._id || r.id) === String(roomId));
  const isOnline = usePresenceStore((s) =>
    room?.type === 'direct'
      ? s.isOnline(room.participants.find((id) => id !== user?.id) || '')
      : false,
  );

  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const directChatUserIds = rooms
    .filter((r) => r.type === 'direct')
    .flatMap((r) => r.participants)
    .filter((id) => id !== user?.id);

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    setIsAdding(true);
    try {
      const { data: updatedRoom } = await api.post(
        `/rooms/${roomId}/participants`,
        {
          userIds: selectedUsers.map((u) => u.id),
        },
      );
      setRooms(rooms.map((r) => ((r._id || r.id) === roomId ? updatedRoom : r)));
      setShowAddMemberModal(false);
      setSelectedUsers([]);
      toast.success(
        'Members added',
        `${selectedUsers.length} ${selectedUsers.length === 1 ? 'person' : 'people'} joined the group.`,
      );
    } catch (err) {
      console.error(err);
      toast.error('Could not add members');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRoom = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/rooms/${roomId}`);
      setRooms(rooms.filter((r) => (r._id || r.id) !== roomId));
      useChatStore.getState().setActiveRoom(null);
      router.push('/chat');
      toast.success('Group deleted');
    } catch (err) {
      console.error(err);
      toast.error('Could not delete group');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getRoomDisplayName = (r: Room | undefined) => {
    if (!r) return 'Conversation';
    if (r.type === 'direct' && r.participantNames) {
      const otherId = r.participants.find((id) => id !== user?.id);
      if (otherId && r.participantNames[otherId]) {
        return r.participantNames[otherId];
      }
    }
    return r.name;
  };

  const displayName = getRoomDisplayName(room);
  const otherId =
    room?.type === 'direct'
      ? room.participants.find((id) => id !== user?.id)
      : undefined;

  return (
    <div className="flex-1 flex flex-col h-full bg-(--canvas) overflow-hidden relative z-10">
      {/* Header */}
      <div className="px-6 py-3.5 bg-(--surface)/85 backdrop-blur-md border-b border-(--line) flex items-center justify-between z-20 shadow-soft">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/chat')}
            className="btn-ghost h-9 w-9 -ml-1 md:hidden"
            aria-label="Back"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {room?.type === 'direct' ? (
            <Avatar name={displayName} userId={otherId} size="md" showStatus />
          ) : (
            <Avatar name={displayName} size="md" isGroup />
          )}
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold tracking-tight text-(--ink) truncate leading-tight">
              {displayName}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {room?.type === 'direct' ? (
                <>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOnline ? 'bg-(--positive)' : 'bg-(--ink-subtle)'
                    }`}
                  />
                  <p
                    className={`font-mono text-[10px] uppercase tracking-wider font-semibold ${
                      isOnline ? 'text-(--positive)' : 'text-(--ink-subtle)'
                    }`}
                  >
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                </>
              ) : (
                <p className="font-mono text-[10px] uppercase tracking-wider font-semibold text-(--ink-subtle)">
                  {room?.participants?.length || 0} members
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 relative" ref={menuRef}>
          <button className="btn-ghost h-9 w-9" title="Search messages">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={`btn-ghost h-9 w-9 ${showMenu ? 'bg-(--line-soft) text-(--ink)' : ''}`}
            aria-label="More actions"
            aria-expanded={showMenu}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-(--surface) rounded-xl shadow-pop border border-(--line) py-1.5 z-40 animate-fade-in-up origin-top-right">
              {room?.type === 'group' && (
                <button
                  onClick={() => {
                    setShowAddMemberModal(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-(--ink) hover:bg-(--line-soft) transition"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-(--ink-muted)" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add members
                </button>
              )}
              <button
                onClick={() => {
                  toast.info('Notifications', 'Per-room mute is coming soon.');
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-(--ink) hover:bg-(--line-soft) transition"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-(--ink-muted)" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Mute notifications
              </button>
              {room?.type === 'group' && room?.createdBy === user?.id && (
                <>
                  <div className="my-1 border-t border-(--line-soft)" />
                  <button
                    onClick={() => {
                      setShowDeleteModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-(--danger) hover:bg-(--danger-soft) transition"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete group
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="max-w-3xl mx-auto h-full">
          <MessageList roomId={roomId} />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-(--surface) border-t border-(--line) px-4 py-3 z-10">
        <div className="max-w-3xl mx-auto">
          <TypingIndicator roomId={roomId} />
          <MessageInput roomId={roomId} />
        </div>
      </div>

      {/* Add member modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="Add members"
        description="Search for people you've chatted with before."
        size="md"
      >
        <div className="space-y-5">
          <MemberSelector
            selectedUsers={selectedUsers}
            onChange={setSelectedUsers}
            placeholder="Search known contacts…"
            excludeUserIds={[...(room?.participants || []), user?.id || '']}
            onlyIds={directChatUserIds}
          />
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleAddMembers}
              disabled={isAdding || selectedUsers.length === 0}
              className="btn-primary flex-1"
            >
              {isAdding ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                `Add ${selectedUsers.length || ''}`.trim()
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete this group?"
        description="All members will lose access and the conversation history will be gone."
        size="sm"
      >
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => setShowDeleteModal(false)}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteRoom}
            disabled={isDeleting}
            className="btn-primary flex-1"
            style={{ background: 'var(--danger)' }}
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </Modal>
    </div>
  );
}

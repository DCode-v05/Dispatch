'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { toast } from '@/stores/toastStore';
import api from '@/lib/api';
import MemberSelector from '@/components/chat/MemberSelector';
import Avatar from '@/components/ui/Avatar';

interface User {
  id: string;
  username: string;
  email: string;
}

export default function RoomsPage() {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const { rooms, setRooms, upsertRoom } = useChatStore();
  const router = useRouter();

  const directChatUserIds = rooms
    .filter((r) => r.type === 'direct')
    .flatMap((r) => r.participants)
    .filter((id) => id !== user?.id);

  const groupRooms = rooms.filter((r) => r.type === 'group');

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const participants = selectedUsers.map((u) => u.id);
      const { data } = await api.post('/rooms', {
        name,
        type: 'group',
        participants,
      });
      upsertRoom(data);
      setName('');
      setSelectedUsers([]);
      toast.success(
        'Group created',
        `${data.name} is ready to use.`,
      );
      router.push(`/chat/${data._id || data.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Could not create group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 animate-fade-in-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-(--accent) mb-2">
            Group chats
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-(--ink)">
            Spin up a new room
          </h1>
          <p className="mt-2 text-(--ink-muted) max-w-xl">
            Group chats live alongside your direct conversations. Add a few
            teammates you&apos;ve already started a direct chat with.
          </p>
        </div>

        <form
          onSubmit={createRoom}
          className="card p-6 mb-10 space-y-5 animate-fade-in-up"
        >
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider font-medium text-(--ink-muted) mb-2">
              Room name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Atlas, Weekend Plans…"
              className="input-field"
              required
              maxLength={200}
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider font-medium text-(--ink-muted) mb-2">
              Invite members
            </label>
            <MemberSelector
              selectedUsers={selectedUsers}
              onChange={setSelectedUsers}
              excludeUserIds={[user?.id || '']}
              onlyIds={directChatUserIds}
              placeholder="Search known contacts…"
            />
            {directChatUserIds.length === 0 && (
              <p className="mt-2 text-xs text-(--ink-subtle)">
                Tip: you can only add people you&apos;ve already chatted with
                directly. Use the invite button in the sidebar to add someone
                new.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary w-full py-3"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Creating…
              </>
            ) : (
              'Create group'
            )}
          </button>
        </form>

        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-(--ink) mb-3">
            Your groups
          </h2>
          {groupRooms.length === 0 ? (
            <div className="card p-8 text-center text-(--ink-muted) animate-fade-in-up">
              <p className="text-sm">
                No groups yet. The first one is just a name + a few teammates
                away.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {groupRooms.map((room) => (
                <button
                  key={room._id || room.id}
                  onClick={() => router.push(`/chat/${room._id || room.id}`)}
                  className="flex items-center gap-4 p-4 card hover:border-(--accent)/40 transition text-left animate-fade-in-up"
                >
                  <Avatar name={room.name} size="md" isGroup />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-(--ink) truncate">
                      {room.name}
                    </p>
                    <p className="text-xs text-(--ink-muted) mt-0.5">
                      {room.participants.length} member
                      {room.participants.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5 text-(--ink-subtle)"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset rooms helper (keeps existing call signature working) */}
        <div className="sr-only" aria-hidden>
          {rooms.length}
          <span onClick={() => setRooms(rooms)} />
        </div>
      </div>
    </div>
  );
}

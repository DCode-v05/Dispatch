'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import api from '@/lib/api';
import MemberSelector from '@/components/chat/MemberSelector';

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
  const { rooms, setRooms } = useChatStore();
  const router = useRouter();

  const directChatUserIds = rooms
    .filter(r => r.type === 'direct')
    .flatMap(r => r.participants)
    .filter(id => id !== user?.id);

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const participants = selectedUsers.map(u => u.id);
      const { data } = await api.post('/rooms', { 
        name, 
        type: 'group',
        participants 
      });
      setRooms([data, ...rooms]);
      setName('');
      setSelectedUsers([]);
      router.push(`/chat/${data._id || data.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <h1 className="text-2xl font-bold mb-6">Chat Rooms</h1>

      <form onSubmit={createRoom} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Room Name</label>
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g. Project Alpha, Team Offsite..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" 
            required 
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Add Members</label>
          <MemberSelector 
            selectedUsers={selectedUsers} 
            onChange={setSelectedUsers} 
            excludeUserIds={[user?.id || '']}
            onlyIds={directChatUserIds}
            placeholder="Search known contacts..."
          />
        </div>

        <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50">
          {loading ? 'Creating...' : 'Create Chat Room'}
        </button>
      </form>

      <div className="grid gap-3">
        {rooms.map((room) => (
          <button
            key={room._id || room.id}
            onClick={() => router.push(`/chat/${room._id || room.id}`)}
            className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-left w-full"
          >
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-semibold">
              {room.name[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{room.name}</p>
              <p className="text-sm text-gray-500">{room.participants.length} members</p>
            </div>
          </button>
        ))}
        {rooms.length === 0 && (
          <p className="text-gray-400 text-center py-8">No rooms yet. Create one above!</p>
        )}
      </div>
    </div>
  );
}

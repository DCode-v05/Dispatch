'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { Room } from '@/types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import MemberSelector from './MemberSelector';
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
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const directChatUserIds = rooms
    .filter(r => r.type === 'direct')
    .flatMap(r => r.participants)
    .filter(id => id !== user?.id);

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    setIsAdding(true);
    try {
      const { data: updatedRoom } = await api.post(`/rooms/${roomId}/participants`, {
        userIds: selectedUsers.map(u => u.id)
      });
      setRooms(rooms.map(r => (r._id || r.id) === roomId ? updatedRoom : r));
      setShowAddMemberModal(false);
      setSelectedUsers([]);
    } catch (err) {
      console.error(err);
      alert('Failed to add members');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await api.delete(`/rooms/${roomId}`);
      setRooms(rooms.filter(r => (r._id || r.id) !== roomId));
      useChatStore.getState().setActiveRoom(null);
      router.push('/rooms');
    } catch (err) {
      console.error(err);
      alert('Failed to delete room');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoomDisplayName = (room: Room | undefined) => {
    if (!room) return 'Chat Room';
    if (room.type === 'direct' && room.participantNames) {
      const otherId = room.participants.find((id: string) => id !== user?.id);
      if (otherId && room.participantNames[otherId]) {
        return room.participantNames[otherId];
      }
    }
    return room.name;
  };

  const displayName = getRoomDisplayName(room);

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="px-8 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200 flex items-center justify-between z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-5">
          <Avatar name={displayName} size="md" showStatus userId={room?.type === 'direct' ? room.participants.find(id => id !== user?.id) : undefined} />
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 truncate leading-tight text-lg tracking-tight">{displayName}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              {room?.type === 'direct' ? (
                <>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Online</p>
                </>
              ) : (
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{room?.participants?.length || 0} Members</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 relative">
          <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`p-2.5 rounded-xl transition-all duration-200 ${showMenu ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-40 animate-in fade-in zoom-in duration-200 origin-top-right">
                  {room?.type === 'group' && (
                    <button 
                      onClick={() => { setShowAddMemberModal(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Add Members
                    </button>
                  )}
                  <button 
                    onClick={() => { alert('Notifications settings...'); setShowMenu(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    Mute Notifications
                  </button>
                  {room?.type === 'group' && (
                    <>
                      <div className="my-1 border-t border-slate-100" />
                      <button 
                        onClick={() => { handleDeleteRoom(); setShowMenu(false); }}
                        disabled={isDeleting}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Group
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto relative scroll-smooth bg-slate-50"
        style={{
          backgroundImage: `radial-gradient(#e2e8f0 0.8px, transparent 0.8px)`,
          backgroundSize: '32px 32px',
        }}
      >
        <div className="max-w-4xl mx-auto h-full px-6">
          <MessageList roomId={roomId} />
        </div>
      </div>

      {/* Footer area */}
      <div className="bg-white border-t border-slate-200 px-8 py-4 z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto">
          <TypingIndicator roomId={roomId} />
          <MessageInput roomId={roomId} />
        </div>
      </div>
      {/* Add Member Modal */}
      <Modal 
        isOpen={showAddMemberModal} 
        onClose={() => setShowAddMemberModal(false)}
        title="Add Members"
      >
        <div className="space-y-6">
          <p className="text-sm text-slate-500">Search for users to add them to this group chat.</p>
          <MemberSelector 
            selectedUsers={selectedUsers} 
            onChange={setSelectedUsers} 
            placeholder="Search known contacts..."
            excludeUserIds={[...(room?.participants || []), user?.id || '']}
            onlyIds={directChatUserIds}
          />
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setShowAddMemberModal(false)}
              className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddMembers}
              disabled={isAdding || selectedUsers.length === 0}
              className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
            >
              {isAdding ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Add to Group'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

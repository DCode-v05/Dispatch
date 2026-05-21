'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import { Room } from '@/types';
import Avatar from '@/components/ui/Avatar';
import api from '@/lib/api';

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const { user } = useAuthStore();
  const { rooms, activeRoomId, invitations, setInvitations, setRooms } = useChatStore();
  // const pathname = usePathname();
  const router = useRouter();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const directChats = rooms.filter(r => r.type === 'direct');
  const groupChats = rooms.filter(r => r.type === 'group');

  const getRoomDisplayName = (room: Room) => {
    if (room.type === 'direct' && room.participantNames) {
      const otherId = room.participants.find((id: string) => id !== user?.id);
      if (otherId && room.participantNames[otherId]) {
        return room.participantNames[otherId];
      }
    }
    return room.name;
  };

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
      alert('Invitation sent successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleAcceptInvite = async (id: string) => {
    try {
      const { data: newRoom } = await api.post(`/invitations/${id}/accept`);
      setInvitations(invitations.filter(i => i._id !== id));
      setRooms([...rooms, newRoom]);
      navigateTo(`/chat/${newRoom._id || newRoom.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to accept invitation');
    }
  };

  const handleRejectInvite = async (id: string) => {
    try {
      await api.post(`/invitations/${id}/reject`);
      setInvitations(invitations.filter(i => i._id !== id));
    } catch (err) {
      console.error(err);
      alert('Failed to reject invitation');
    }
  };

  return (
    <div className="h-full bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={user?.username || '?'} size="sm" showStatus userId={user?.id} />
          <h1 className="font-bold text-slate-900 text-xl tracking-tight hidden md:block">Messages</h1>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => setShowInviteModal(true)}
            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
            title="Invite Person"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          <button 
            onClick={() => navigateTo('/rooms')}
            className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
            title="Create Group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative group">
          <input 
            type="text" 
            placeholder="Search conversations..."
            className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-11 pr-4 text-sm font-medium text-slate-600 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all duration-200"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3.5 top-2.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {/* Invitations */}
        {invitations.length > 0 && (
          <div className="mb-4 px-3">
            <p className="py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending ({invitations.length})</p>
            {invitations.map((invite) => (
              <div key={invite._id} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 flex items-center justify-between mb-1">
                <div className="flex items-center gap-3 truncate">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm">
                    {invite.senderEmail[0].toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-bold text-slate-800 truncate">{invite.senderEmail}</p>
                    <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-tight">Sent an invite</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => handleAcceptInvite(invite._id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button onClick={() => handleRejectInvite(invite._id)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Direct Chats */}
        <p className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Chats</p>
        {directChats.map((room) => {
          const id = String(room._id || room.id);
          const isActive = String(activeRoomId) === id;
          return (
            <button
              key={id}
              onClick={() => navigateTo(`/chat/${id}`)}
              className={`w-full text-left p-3.5 flex items-center gap-4 rounded-2xl transition-all duration-200 group relative ${
                isActive ? 'bg-white shadow-md' : 'hover:bg-slate-100'
              }`}
            >
              {isActive && <div className="absolute left-1.5 top-3.5 bottom-3.5 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div>}
              <Avatar name={getRoomDisplayName(room)} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                    {getRoomDisplayName(room)}
                  </h3>
                  <span className={`text-[10px] font-bold ${isActive ? 'text-indigo-500' : 'text-slate-400'}`}>
                    {room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className={`text-xs truncate font-medium transition-colors ${isActive ? 'text-slate-500' : 'text-slate-400'}`}>
                  Hey, how are you doing?
                </p>
              </div>
            </button>
          );
        })}

        {/* Group Chats */}
        {groupChats.length > 0 && (
          <>
            <p className="px-3 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Channels</p>
            {groupChats.map((room) => {
              const id = String(room._id || room.id);
              const isActive = String(activeRoomId) === id;
              return (
                <button
                  key={id}
                  onClick={() => navigateTo(`/chat/${id}`)}
                  className={`w-full text-left p-3.5 flex items-center gap-4 rounded-2xl transition-all duration-200 group ${
                    isActive ? 'bg-white shadow-md' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="w-12 h-12 bg-slate-200 text-slate-500 rounded-2xl flex items-center justify-center font-bold text-xl group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                    #
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h3 className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>{room.name}</h3>
                      <span className="text-[10px] font-bold text-slate-400">
                        {room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-400 truncate">{room.participants.length} participants</p>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* User Footer */}
      <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-4">
        <button 
          onClick={() => navigateTo('/settings')}
          className="flex-1 flex items-center gap-3 p-1.5 hover:bg-slate-50 rounded-xl transition-all duration-200 text-left truncate group"
        >
          <div className="relative">
            <Avatar name={user?.username || '?'} size="sm" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></div>
          </div>
          <div className="truncate">
            <p className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">{user?.username}</p>
            <p className="text-[10px] font-bold text-slate-400 truncate tracking-tight">{user?.email}</p>
          </div>
        </button>
        <button 
          onClick={() => {
            if (confirm('Are you sure you want to logout?')) {
              useAuthStore.getState().logout();
              router.push('/login');
            }
          }}
          className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-200"
          title="Logout"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Start a new chat</h2>
                <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-6">Enter the email address of the person you&apos;d like to chat with. We&apos;ll send them an invitation.</p>
              <form onSubmit={handleSendInvite}>
                <div className="mb-6">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-3 px-4 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isInviting}
                    className="flex-1 py-3 px-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isInviting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Send Invitation'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

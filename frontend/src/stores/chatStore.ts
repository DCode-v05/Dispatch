import { create } from 'zustand';
import type { Room, Message, Invitation } from '@/types';

interface ChatState {
  rooms: Room[];
  activeRoomId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  invitations: Invitation[];
  setRooms: (rooms: Room[]) => void;
  setActiveRoom: (roomId: string | null) => void;
  addMessage: (roomId: string, message: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  setTyping: (roomId: string, userIds: string[]) => void;
  setInvitations: (invitations: Invitation[]) => void;
  markMessagesAsRead: (roomId: string, userId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  rooms: [],
  activeRoomId: null,
  messages: {},
  typingUsers: {},
  invitations: [],

  setRooms: (rooms) => set({ rooms }),
  setActiveRoom: (roomId) => set({ activeRoomId: roomId }),

  addMessage: (roomId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), message],
      },
    })),

  setMessages: (roomId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [roomId]: messages },
    })),

  setTyping: (roomId, userIds) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [roomId]: userIds },
    })),
  setInvitations: (invitations) => set({ invitations }),

  markMessagesAsRead: (roomId, userId) =>
    set((state) => {
      const roomMessages = state.messages[roomId] || [];
      const updatedMessages = roomMessages.map((msg) => {
        if (!msg.readBy?.includes(userId)) {
          return { ...msg, readBy: [...(msg.readBy || []), userId] };
        }
        return msg;
      });

      return {
        messages: { ...state.messages, [roomId]: updatedMessages },
      };
    }),
}));

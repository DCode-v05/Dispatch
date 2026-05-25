import { create } from 'zustand';
import type { Room, Message, Invitation } from '@/types';

const TYPING_IDLE_MS = 3500;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface ChatState {
  rooms: Room[];
  activeRoomId: string | null;
  messages: Record<string, Message[]>;
  /** Per-room count of incoming messages received while the room was NOT active. */
  unread: Record<string, number>;
  typingUsers: Record<string, string[]>;
  invitations: Invitation[];

  setRooms: (rooms: Room[]) => void;
  upsertRoom: (room: Room) => void;
  setActiveRoom: (roomId: string | null) => void;

  addMessage: (roomId: string, message: Message, opts?: { fromSelf?: boolean }) => void;
  removeMessage: (roomId: string, messageId: string) => void;
  replaceLocalMessage: (roomId: string, localId: string, persisted: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  setTyping: (roomId: string, userIds: string[]) => void;
  markUserTyping: (roomId: string, userId: string) => void;
  setInvitations: (invitations: Invitation[]) => void;
  upsertInvitation: (invitation: Invitation) => void;
  removeInvitation: (id: string) => void;
  markMessagesAsRead: (roomId: string, userId: string) => void;
  clearUnread: (roomId: string) => void;
  removeRoom: (roomId: string) => void;
  patchRoomParticipants: (roomId: string, participants: string[]) => void;
}

function updateRoomMetaFromMessage(rooms: Room[], roomId: string, msg: Message): Room[] {
  return rooms.map((r) => {
    if (String(r._id || r.id) !== String(roomId)) return r;
    return {
      ...r,
      lastMessageAt: msg.timestamp || msg.createdAt || new Date().toISOString(),
      lastMessageContent: msg.content,
      lastMessageSenderId: msg.senderId,
    };
  });
}

export const useChatStore = create<ChatState>((set) => ({
  rooms: [],
  activeRoomId: null,
  messages: {},
  unread: {},
  typingUsers: {},
  invitations: [],

  setRooms: (rooms) => set({ rooms }),
  upsertRoom: (room) =>
    set((s) => {
      const id = String(room._id || room.id);
      const exists = s.rooms.some((r) => String(r._id || r.id) === id);
      const next = exists
        ? s.rooms.map((r) => (String(r._id || r.id) === id ? { ...r, ...room } : r))
        : [room, ...s.rooms];
      return { rooms: next };
    }),

  setActiveRoom: (roomId) =>
    set((s) => ({
      activeRoomId: roomId,
      unread: roomId ? { ...s.unread, [roomId]: 0 } : s.unread,
    })),

  addMessage: (roomId, message, opts) =>
    set((state) => {
      const existing = state.messages[roomId] ?? [];
      // De-dup: if a permanent _id arrives, drop any local-id copy of the same content+sender
      const filtered = message._id
        ? existing.filter(
            (m) =>
              !(
                m.id?.startsWith('local_') &&
                m.senderId === message.senderId &&
                m.content === message.content
              ),
          )
        : existing;
      return {
        messages: { ...state.messages, [roomId]: [...filtered, message] },
        rooms: updateRoomMetaFromMessage(state.rooms, roomId, message),
        unread:
          opts?.fromSelf || state.activeRoomId === roomId
            ? state.unread
            : { ...state.unread, [roomId]: (state.unread[roomId] ?? 0) + 1 },
      };
    }),

  removeMessage: (roomId, messageId) =>
    set((state) => {
      const existing = state.messages[roomId] ?? [];
      const next = existing.filter(
        (m) => m.id !== messageId && m._id !== messageId,
      );
      if (next.length === existing.length) return state;
      // If we removed the last message, refresh that room's preview from
      // whatever new tail remains. If no messages left, clear preview fields.
      const tail = next[next.length - 1];
      const rooms = state.rooms.map((r) => {
        if (String(r._id || r.id) !== String(roomId)) return r;
        if (tail) {
          return {
            ...r,
            lastMessageAt:
              tail.timestamp || tail.createdAt || r.lastMessageAt,
            lastMessageContent: tail.content,
            lastMessageSenderId: tail.senderId,
          };
        }
        return {
          ...r,
          lastMessageContent: undefined,
          lastMessageSenderId: undefined,
        };
      });
      return {
        messages: { ...state.messages, [roomId]: next },
        rooms,
      };
    }),

  replaceLocalMessage: (roomId, localId, persisted) =>
    set((state) => {
      const existing = state.messages[roomId] ?? [];
      const replaced = existing.map((m) => (m.id === localId ? persisted : m));
      return {
        messages: { ...state.messages, [roomId]: replaced },
        rooms: updateRoomMetaFromMessage(state.rooms, roomId, persisted),
      };
    }),

  setMessages: (roomId, messages) =>
    set((state) => {
      const last = messages[messages.length - 1];
      const rooms = last
        ? updateRoomMetaFromMessage(state.rooms, roomId, last)
        : state.rooms;
      return {
        messages: { ...state.messages, [roomId]: messages },
        rooms,
      };
    }),

  setTyping: (roomId, userIds) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [roomId]: userIds },
    })),

  markUserTyping: (roomId, userId) => {
    set((state) => {
      const current = state.typingUsers[roomId] ?? [];
      if (current.includes(userId)) return state;
      return {
        typingUsers: { ...state.typingUsers, [roomId]: [...current, userId] },
      };
    });
    // Auto-clear after idle window. Re-typing resets the timer.
    const key = `${roomId}::${userId}`;
    const existing = typingTimers.get(key);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(() => {
      typingTimers.delete(key);
      useChatStore.setState((state) => {
        const current = state.typingUsers[roomId] ?? [];
        if (!current.includes(userId)) return state;
        return {
          typingUsers: {
            ...state.typingUsers,
            [roomId]: current.filter((id) => id !== userId),
          },
        };
      });
    }, TYPING_IDLE_MS);
    typingTimers.set(key, handle);
  },

  setInvitations: (invitations) => set({ invitations }),

  upsertInvitation: (invitation) =>
    set((s) => {
      const exists = s.invitations.some((i) => i._id === invitation._id);
      const invitations = exists
        ? s.invitations.map((i) =>
            i._id === invitation._id ? { ...i, ...invitation } : i,
          )
        : [invitation, ...s.invitations];
      return { invitations };
    }),

  removeInvitation: (id) =>
    set((s) => ({ invitations: s.invitations.filter((i) => i._id !== id) })),

  removeRoom: (roomId) =>
    set((s) => {
      const messages = { ...s.messages };
      delete messages[roomId];
      const unread = { ...s.unread };
      delete unread[roomId];
      const typingUsers = { ...s.typingUsers };
      delete typingUsers[roomId];
      return {
        rooms: s.rooms.filter((r) => String(r._id || r.id) !== String(roomId)),
        activeRoomId:
          String(s.activeRoomId) === String(roomId) ? null : s.activeRoomId,
        messages,
        unread,
        typingUsers,
      };
    }),

  patchRoomParticipants: (roomId, participants) =>
    set((s) => ({
      rooms: s.rooms.map((r) =>
        String(r._id || r.id) === String(roomId)
          ? { ...r, participants }
          : r,
      ),
    })),

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

  clearUnread: (roomId) =>
    set((s) => ({ unread: { ...s.unread, [roomId]: 0 } })),
}));

// Selector helpers
export const selectLastMessagePreview = (roomId: string) => {
  const { messages, rooms } = useChatStore.getState();
  const list = messages[roomId];
  if (list && list.length > 0) {
    return list[list.length - 1];
  }
  const room = rooms.find((r) => String(r._id || r.id) === String(roomId));
  if (room?.lastMessageContent) {
    return {
      content: room.lastMessageContent,
      senderId: room.lastMessageSenderId,
      timestamp: room.lastMessageAt,
    };
  }
  return null;
};

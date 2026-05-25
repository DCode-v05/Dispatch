import { create } from 'zustand';
import type { Room, Message, Invitation } from '@/types';

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
  replaceLocalMessage: (roomId: string, localId: string, persisted: Message) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  setTyping: (roomId: string, userIds: string[]) => void;
  setInvitations: (invitations: Invitation[]) => void;
  markMessagesAsRead: (roomId: string, userId: string) => void;
  clearUnread: (roomId: string) => void;
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

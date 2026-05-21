import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Set<string>;
  setOnlineUsers: (ids: string[]) => void;
  setUserOnline: (id: string) => void;
  setUserOffline: (id: string) => void;
  isOnline: (id: string) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUsers: new Set(),

  setOnlineUsers: (ids) => set({ onlineUsers: new Set(ids) }),

  setUserOnline: (id) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.add(id);
      return { onlineUsers: next };
    }),

  setUserOffline: (id) =>
    set((state) => {
      const next = new Set(state.onlineUsers);
      next.delete(id);
      return { onlineUsers: next };
    }),

  isOnline: (id) => get().onlineUsers.has(id),
}));

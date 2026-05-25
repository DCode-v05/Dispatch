'use client';

import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'> & { id?: string; ttl?: number }) => string;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: ({ id, ttl = 4000, ...rest }) => {
    const toastId = id ?? `t_${Date.now()}_${++counter}`;
    set((s) => ({
      toasts: [...s.toasts.filter((t) => t.id !== toastId), { id: toastId, ...rest }],
    }));
    if (ttl > 0) {
      setTimeout(() => {
        get().dismiss(toastId);
      }, ttl);
    }
    return toastId;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helpers
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: 'info', title, description }),
};

import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import type { User } from '@/types';
import {
  clearToken,
  getToken,
  isTokenExpired,
  setToken,
} from '@/lib/auth-token';
import { disconnectAll } from '@/lib/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: (token: string, user: User) => {
    setToken(token, 7);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    clearToken();
    disconnectAll();
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrate: () => {
    const token = getToken();
    if (!token) return;
    if (isTokenExpired(token)) {
      clearToken();
      return;
    }
    try {
      const decoded = jwtDecode<{
        sub: string;
        email: string;
        username?: string;
      }>(token);
      set({
        token,
        isAuthenticated: true,
        user: {
          id: decoded.sub,
          email: decoded.email,
          username: decoded.username || decoded.email.split('@')[0],
        },
      });
    } catch {
      clearToken();
    }
  },
}));

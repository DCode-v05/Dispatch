import { create } from 'zustand';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import type { User } from '@/types';

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
    Cookies.set('accessToken', token, { expires: 7 });
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    Cookies.remove('accessToken');
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrate: () => {
    const token = Cookies.get('accessToken');
    if (token) {
      try {
        const decoded = jwtDecode<{ sub: string; email: string; username?: string }>(token);
        set({
          token,
          isAuthenticated: true,
          user: { 
            id: decoded.sub, 
            email: decoded.email, 
            username: decoded.username || decoded.email.split('@')[0] 
          },
        });
      } catch {
        Cookies.remove('accessToken');
      }
    }
  },
}));

import axios, { AxiosInstance } from 'axios';
import Cookies from 'js-cookie';

const FALLBACK = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80/api';

const USER_URL     = process.env.NEXT_PUBLIC_USER_URL     || FALLBACK;
const CHAT_URL     = process.env.NEXT_PUBLIC_CHAT_URL     || FALLBACK;
const MESSAGE_URL  = process.env.NEXT_PUBLIC_MESSAGE_URL  || FALLBACK;
const NOTIF_URL    = process.env.NEXT_PUBLIC_NOTIF_URL    || FALLBACK;
const PRESENCE_URL = process.env.NEXT_PUBLIC_PRESENCE_URL || FALLBACK;

function makeClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = Cookies.get('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        Cookies.remove('accessToken');
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

const userApi     = makeClient(USER_URL);
const chatApi     = makeClient(CHAT_URL);
const messageApi  = makeClient(MESSAGE_URL);
const notifApi    = makeClient(NOTIF_URL);
const presenceApi = makeClient(PRESENCE_URL);

function clientFor(url: string): AxiosInstance {
  if (url.startsWith('/auth') || url.startsWith('/users')) return userApi;
  if (url.startsWith('/rooms') || url.startsWith('/invitations')) return chatApi;
  if (url.startsWith('/messages')) return messageApi;
  if (url.startsWith('/notifications')) return notifApi;
  if (url.startsWith('/presence')) return presenceApi;
  return userApi;
}

const api = new Proxy({} as AxiosInstance, {
  get(_target, prop: string) {
    if (prop === 'request') {
      return (config: { url?: string }) => clientFor(config.url ?? '').request(config);
    }
    return (url: string, ...rest: unknown[]) => {
      const client = clientFor(url);
      const method = (client as unknown as Record<string, (...args: unknown[]) => unknown>)[prop];
      return method.call(client, url, ...rest);
    };
  },
});

export default api;

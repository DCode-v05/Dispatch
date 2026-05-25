import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { clearToken, getValidToken } from './auth-token';

const FALLBACK = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80/api';

const USER_URL     = process.env.NEXT_PUBLIC_USER_URL     || FALLBACK;
const CHAT_URL     = process.env.NEXT_PUBLIC_CHAT_URL     || FALLBACK;
const MESSAGE_URL  = process.env.NEXT_PUBLIC_MESSAGE_URL  || FALLBACK;
const NOTIF_URL    = process.env.NEXT_PUBLIC_NOTIF_URL    || FALLBACK;
const PRESENCE_URL = process.env.NEXT_PUBLIC_PRESENCE_URL || FALLBACK;

const DEFAULT_TIMEOUT_MS = 35_000; // > Render free-tier cold start (~30s)
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

function shouldRetry(err: AxiosError, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  // Don't retry mutations beyond 1 attempt to avoid duplicates
  const method = (err.config?.method ?? 'get').toLowerCase();
  const isIdempotent = ['get', 'head', 'options'].includes(method);
  if (!isIdempotent && attempt >= 1) return false;
  // Retry on network errors, timeouts, or 502/503/504 (typical cold-start signal)
  if (!err.response) return true;
  return [502, 503, 504].includes(err.response.status);
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function makeClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getValidToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (!config.headers['x-request-id']) {
      config.headers['x-request-id'] = generateRequestId();
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Retry on transient errors with exponential backoff
      const config = error.config as
        | (AxiosRequestConfig & { __retryCount?: number })
        | undefined;
      if (!config) return Promise.reject(error);
      const attempt = config.__retryCount ?? 0;
      if (shouldRetry(error, attempt)) {
        config.__retryCount = attempt + 1;
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        return client.request(config);
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
      return (config: { url?: string }) =>
        clientFor(config.url ?? '').request(config);
    }
    return (url: string, ...rest: unknown[]) => {
      const client = clientFor(url);
      const method = (client as unknown as Record<string, (...args: unknown[]) => unknown>)[prop];
      return method.call(client, url, ...rest);
    };
  },
});

export default api;

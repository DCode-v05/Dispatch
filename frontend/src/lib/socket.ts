import { io, Socket } from 'socket.io-client';
import { getValidToken } from './auth-token';

const FALLBACK = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:80';

const CHAT_WS     = process.env.NEXT_PUBLIC_CHAT_WS     || FALLBACK;
const PRESENCE_WS = process.env.NEXT_PUBLIC_PRESENCE_WS || FALLBACK;
const NOTIF_WS    = process.env.NEXT_PUBLIC_NOTIF_WS    || FALLBACK;

interface SocketConfig {
  reconnection: true;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  reconnectionDelayMax: number;
  randomizationFactor: number;
  timeout: number;
  autoConnect: false;
  transports?: ('websocket' | 'polling')[];
}

const BASE_OPTS: SocketConfig = {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 500,
  reconnectionDelayMax: 8_000,
  randomizationFactor: 0.5,
  timeout: 20_000,
};

let chatSocket: Socket | null = null;
let presenceSocket: Socket | null = null;
let notificationSocket: Socket | null = null;

function attachLifecycleLogging(name: string, socket: Socket): Socket {
  socket.on('connect_error', (err) => {
    // eslint-disable-next-line no-console
    console.warn(`[${name}] connect_error:`, err.message);
  });
  socket.on('unauthorized', () => {
    // eslint-disable-next-line no-console
    console.warn(`[${name}] server marked socket unauthorized — disconnecting`);
    socket.disconnect();
  });
  socket.io.on('reconnect_attempt', () => {
    // Refresh the token before every reconnect attempt — it may have rotated
    const token = getValidToken();
    socket.auth = { token };
  });
  return socket;
}

export function getChatSocket(): Socket {
  if (!chatSocket) {
    chatSocket = io(`${CHAT_WS}/chat`, {
      ...BASE_OPTS,
      auth: { token: getValidToken() },
    });
    attachLifecycleLogging('chat', chatSocket);
  }
  return chatSocket;
}

export function getPresenceSocket(): Socket {
  if (!presenceSocket) {
    presenceSocket = io(`${PRESENCE_WS}/presence`, {
      ...BASE_OPTS,
      auth: { token: getValidToken() },
    });
    attachLifecycleLogging('presence', presenceSocket);
  }
  return presenceSocket;
}

export function getNotificationSocket(): Socket {
  if (!notificationSocket) {
    notificationSocket = io(`${NOTIF_WS}/notifications`, {
      ...BASE_OPTS,
      auth: { token: getValidToken() },
    });
    attachLifecycleLogging('notifications', notificationSocket);
  }
  return notificationSocket;
}

export function disconnectAll(): void {
  chatSocket?.disconnect();
  presenceSocket?.disconnect();
  notificationSocket?.disconnect();
  chatSocket = null;
  presenceSocket = null;
  notificationSocket = null;
}

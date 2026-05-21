import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

const FALLBACK = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:80';

const CHAT_WS     = process.env.NEXT_PUBLIC_CHAT_WS     || FALLBACK;
const PRESENCE_WS = process.env.NEXT_PUBLIC_PRESENCE_WS || FALLBACK;
const NOTIF_WS    = process.env.NEXT_PUBLIC_NOTIF_WS    || FALLBACK;

let chatSocket: Socket | null = null;
let presenceSocket: Socket | null = null;
let notificationSocket: Socket | null = null;

export function getChatSocket(): Socket {
  if (!chatSocket) {
    chatSocket = io(`${CHAT_WS}/chat`, {
      auth: { token: Cookies.get('accessToken') },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return chatSocket;
}

export function getPresenceSocket(): Socket {
  if (!presenceSocket) {
    presenceSocket = io(`${PRESENCE_WS}/presence`, {
      auth: { token: Cookies.get('accessToken') },
      autoConnect: false,
      reconnection: true,
    });
  }
  return presenceSocket;
}

export function getNotificationSocket(): Socket {
  if (!notificationSocket) {
    notificationSocket = io(`${NOTIF_WS}/notifications`, {
      auth: { token: Cookies.get('accessToken') },
      autoConnect: false,
      reconnection: true,
    });
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

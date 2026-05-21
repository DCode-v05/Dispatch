import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

let chatSocket: Socket | null = null;
let presenceSocket: Socket | null = null;
let notificationSocket: Socket | null = null;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:80';

export function getChatSocket(): Socket {
  if (!chatSocket) {
    chatSocket = io(`${WS_URL}/chat`, {
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
    presenceSocket = io(`${WS_URL}/presence`, {
      auth: { token: Cookies.get('accessToken') },
      autoConnect: false,
      reconnection: true,
    });
  }
  return presenceSocket;
}

export function getNotificationSocket(): Socket {
  if (!notificationSocket) {
    notificationSocket = io(`${WS_URL}/notifications`, {
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

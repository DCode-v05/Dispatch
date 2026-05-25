export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

export type MessageDeliveryStatus =
  | 'pending' // optimistically added, not yet acknowledged by server
  | 'sent' // server has persisted (has messageId/_id from backend)
  | 'delivered' // at least one recipient is currently online
  | 'seen'; // at least one recipient has read the message

export interface Message {
  id: string;
  _id?: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: string;
  createdAt?: string;
  readBy: string[];
  /** Set on the sender's local copy; remote messages don't carry this. */
  status?: MessageDeliveryStatus;
}

export interface Room {
  id: string;
  _id?: string;
  name: string;
  type: 'group' | 'direct';
  participants: string[];
  participantNames?: Record<string, string>;
  lastMessageAt?: string;
  lastMessageContent?: string;
  lastMessageSenderId?: string;
  unreadCount?: number;
  createdBy: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface Notification {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface Invitation {
  _id: string;
  senderId: string;
  senderEmail: string;
  senderUsername: string;
  receiverEmail: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

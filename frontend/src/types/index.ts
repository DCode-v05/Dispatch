export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isOnline?: boolean;
}

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
}

export interface Room {
  id: string;
  _id?: string;
  name: string;
  type: 'group' | 'direct';
  participants: string[];
  participantNames?: Record<string, string>;
  lastMessageAt?: string;
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

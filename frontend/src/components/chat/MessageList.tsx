'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { deriveStatus } from '@/lib/message-status';
import { formatDate, isDifferentDay } from '@/lib/utils';
import type { Message } from '@/types';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  roomId: string;
}

const EMPTY_MESSAGES: Message[] = [];

function senderNameFor(msg: Message, participantNames?: Record<string, string>): string {
  if (msg.senderName) return msg.senderName;
  if (participantNames && participantNames[msg.senderId]) {
    return participantNames[msg.senderId];
  }
  return 'Someone';
}

export default function MessageList({ roomId }: MessageListProps) {
  const messages = useChatStore((s) => s.messages[roomId] || EMPTY_MESSAGES);
  const room = useChatStore((s) =>
    s.rooms.find((r) => String(r._id || r.id) === String(roomId)),
  );
  const user = useAuthStore((s) => s.user);
  const onlineSnapshot = usePresenceStore((s) => s.onlineUsers);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const handleDelete = useCallback(
    async (msg: Message) => {
      const serverId = msg._id || msg.id;
      if (!serverId || serverId.startsWith?.('local_') || serverId.startsWith?.('m_')) {
        // Not yet persisted — just drop from local store
        useChatStore.getState().removeMessage(roomId, msg.id);
        return;
      }
      // Optimistically remove; restore on error
      useChatStore.getState().removeMessage(roomId, msg.id);
      try {
        await api.delete(`/messages/${serverId}`);
      } catch (err) {
        console.error('delete message failed', err);
        toast.error(
          'Could not delete message',
          'It will reappear on next refresh.',
        );
      }
    },
    [roomId],
  );

  const items = useMemo(() => {
    const rendered: Array<
      | { kind: 'divider'; key: string; label: string }
      | {
          kind: 'message';
          key: string;
          msg: Message;
          isOwn: boolean;
          isGrouped: boolean;
          isGroupTail: boolean;
          senderName?: string;
        }
    > = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const ts = msg.timestamp || msg.createdAt;
      const prevTs = prev?.timestamp || prev?.createdAt;

      if (isDifferentDay(prevTs, ts)) {
        rendered.push({
          kind: 'divider',
          key: `d_${ts || i}`,
          label: ts ? formatDate(ts) : '',
        });
      }

      const isOwn = msg.senderId === user?.id;
      // "Grouped" = previous message is from the same sender AND within 5 min AND same day
      const sameDay = !isDifferentDay(prevTs, ts);
      const sameSender = prev && prev.senderId === msg.senderId;
      const closeInTime =
        prevTs && ts
          ? Math.abs(new Date(ts).getTime() - new Date(prevTs).getTime()) < 5 * 60_000
          : false;
      const isGrouped = !!(sameDay && sameSender && closeInTime);

      // "Group tail" = the next message is from a different sender or far away
      const nextSameSender = next && next.senderId === msg.senderId;
      const nextTs = next?.timestamp || next?.createdAt;
      const nextClose =
        nextTs && ts
          ? Math.abs(new Date(nextTs).getTime() - new Date(ts).getTime()) < 5 * 60_000
          : false;
      const isGroupTail = !(nextSameSender && nextClose);

      rendered.push({
        kind: 'message',
        key: msg.id || msg._id || `${ts}-${i}`,
        msg,
        isOwn,
        isGrouped,
        isGroupTail,
        senderName: !isOwn
          ? senderNameFor(msg, room?.participantNames)
          : undefined,
      });
    }
    return rendered;
  }, [messages, user?.id, room?.participantNames]);

  return (
    <div className="flex-1 px-4 py-6 relative">
      <div className="flex flex-col min-h-full">
        <div className="flex-1" />

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-14 w-14 rounded-2xl bg-(--accent-soft) text-(--accent) flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="font-display font-bold text-(--ink) tracking-tight">
              No messages yet
            </p>
            <p className="text-sm text-(--ink-muted) mt-1">
              Send the first message to get the conversation started.
            </p>
          </div>
        ) : (
          <div>
            {items.map((item) => {
              if (item.kind === 'divider') {
                return (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 my-4 px-1"
                  >
                    <div className="flex-1 h-px bg-(--line)" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold text-(--ink-subtle) px-2 py-1 rounded-full bg-(--surface) border border-(--line-soft)">
                      {item.label}
                    </span>
                    <div className="flex-1 h-px bg-(--line)" />
                  </div>
                );
              }
              const status = item.isOwn
                ? deriveStatus(item.msg, room, onlineSnapshot)
                : 'sent';
              return (
                <MessageBubble
                  key={item.key}
                  message={item.msg}
                  isOwn={item.isOwn}
                  status={status}
                  isGrouped={item.isGrouped}
                  isGroupTail={item.isGroupTail}
                  senderName={item.senderName}
                  onDelete={
                    item.isOwn ? () => void handleDelete(item.msg) : undefined
                  }
                />
              );
            })}
          </div>
        )}

        <div ref={bottomRef} className="h-4" />
      </div>
    </div>
  );
}

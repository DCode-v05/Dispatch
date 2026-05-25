'use client';

import { formatTime } from '@/lib/utils';
import type { Message, MessageDeliveryStatus } from '@/types';
import Avatar from '@/components/ui/Avatar';
import MessageStatus from './MessageStatus';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  status: MessageDeliveryStatus;
  /** True if this is part of a consecutive run by the same sender. */
  isGrouped?: boolean;
  /** True if this is the LAST message of a consecutive run (footer slot). */
  isGroupTail?: boolean;
  /** Sender display name (only shown on first message in a group, non-own). */
  senderName?: string;
}

export default function MessageBubble({
  message,
  isOwn,
  status,
  isGrouped = false,
  isGroupTail = true,
  senderName,
}: MessageBubbleProps) {
  const time = formatTime(message.timestamp || message.createdAt || '');

  // Bubble shape adapts based on grouping (tail vs body)
  const ownShape = isGrouped
    ? 'rounded-2xl rounded-tr-md'
    : 'rounded-2xl rounded-tr-sm';
  const otherShape = isGrouped
    ? 'rounded-2xl rounded-tl-md'
    : 'rounded-2xl rounded-tl-sm';

  return (
    <div
      className={`group flex items-end gap-2 px-1 ${
        isOwn ? 'justify-end flex-row-reverse' : 'justify-start'
      } ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
    >
      {/* Avatar (only for received, only on last bubble in a group) */}
      {!isOwn && (
        <div className={`w-9 shrink-0 ${isGroupTail ? '' : 'invisible'}`}>
          {isGroupTail && (
            <Avatar
              name={senderName || message.senderName || '?'}
              size="sm"
              userId={message.senderId}
            />
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Sender name — only on first message of a run from someone else */}
        {!isOwn && senderName && !isGrouped && (
          <span className="text-[11px] font-semibold text-(--ink-muted) ml-3 mb-0.5">
            {senderName}
          </span>
        )}

        <div
          className={`relative px-4 py-2.5 transition-shadow ${
            isOwn
              ? `${ownShape} text-(--accent-ink) shadow-soft`
              : `${otherShape} bg-(--bubble-other) text-(--bubble-other-ink) border border-(--line-soft) shadow-soft`
          }`}
          style={
            isOwn
              ? {
                  background:
                    'linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--accent) 85%, var(--ink)))',
                }
              : undefined
          }
        >
          <p className="text-[15px] leading-relaxed font-medium break-words whitespace-pre-wrap">
            {message.content}
          </p>

          <div
            className={`flex items-center justify-end gap-1.5 mt-1 -mb-0.5 ${
              isOwn ? 'text-white/75' : 'text-(--ink-subtle)'
            }`}
          >
            <span className="font-mono text-[10px] tracking-wide leading-none">
              {time}
            </span>
            <MessageStatus status={status} isOwn={isOwn} />
          </div>
        </div>
      </div>
    </div>
  );
}

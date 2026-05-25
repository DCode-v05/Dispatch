'use client';

import { useState } from 'react';
import { formatTime } from '@/lib/utils';
import type { Message, MessageDeliveryStatus } from '@/types';
import Avatar from '@/components/ui/Avatar';
import MessageStatus from './MessageStatus';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  status: MessageDeliveryStatus;
  isGrouped?: boolean;
  isGroupTail?: boolean;
  senderName?: string;
  /** If set, a trash icon appears on hover and calls this when clicked. */
  onDelete?: () => void;
}

/**
 * Layout convention:
 *   • Sent (own) bubbles align to the RIGHT edge of the conversation column.
 *   • Received bubbles align to the LEFT edge, with the sender's avatar
 *     flush to the LEFT of the bubble.
 */
export default function MessageBubble({
  message,
  isOwn,
  status,
  isGrouped = false,
  isGroupTail = true,
  senderName,
  onDelete,
}: MessageBubbleProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const time = formatTime(message.timestamp || message.createdAt || '');

  // Bubble tail is cut on the side adjacent to the alignment edge.
  const ownShape = isGrouped
    ? 'rounded-2xl rounded-tr-md'
    : 'rounded-2xl rounded-tr-sm';
  const otherShape = isGrouped
    ? 'rounded-2xl rounded-tl-md'
    : 'rounded-2xl rounded-tl-sm';

  const bubbleInner = (
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
      <p className="text-[15px] leading-relaxed font-medium wrap-break-word whitespace-pre-wrap">
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
  );

  return (
    <div
      className={`group flex items-end gap-2 px-1 ${
        isOwn ? 'justify-end' : 'justify-start'
      } ${isGrouped ? 'mt-0.5' : 'mt-3'}`}
    >
      {/* Received: avatar to the LEFT of the bubble (only on group tail) */}
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

      <div
        className={`flex flex-col max-w-[75%] ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {!isOwn && senderName && !isGrouped && (
          <span className="text-[11px] font-semibold text-(--ink-muted) ml-3 mb-0.5">
            {senderName}
          </span>
        )}

        <div className="relative flex items-center gap-1.5">
          {/* Delete action — only own messages with an onDelete handler */}
          {isOwn && onDelete && (
            <>
              {confirmingDelete ? (
                <div className="flex items-center gap-1 animate-fade-in-up order-1">
                  <button
                    onClick={() => {
                      onDelete();
                      setConfirmingDelete(false);
                    }}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-(--danger) text-white hover:opacity-90"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-(--ink-muted) hover:text-(--ink)"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="order-1 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 rounded-lg bg-(--surface) border border-(--line-soft) text-(--ink-subtle) hover:text-(--danger) hover:border-(--danger)/40 flex items-center justify-center shadow-soft"
                  title="Delete message"
                  aria-label="Delete message"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <div className="order-2">{bubbleInner}</div>
            </>
          )}
          {!(isOwn && onDelete) && bubbleInner}
        </div>
      </div>
    </div>
  );
}

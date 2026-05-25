'use client';

import { useRef, useState } from 'react';
import { getChatSocket } from '@/lib/socket';
import { toast } from '@/stores/toastStore';

interface MessageInputProps {
  roomId: string;
}

const MAX_HEIGHT = 160;

export default function MessageInput({ roomId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  };

  const sendMessage = () => {
    const text = content.trim();
    if (!text) return;
    const socket = getChatSocket();
    socket.emit('send_message', { roomId, content: text });
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = () => {
    const socket = getChatSocket();
    socket.emit('typing', { roomId });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    resize(e.target);
    handleTyping();
  };

  const hasContent = content.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 bg-(--surface) rounded-2xl border border-(--line) p-1.5 shadow-soft focus-within:border-(--accent)/40 focus-within:shadow-pop transition"
    >
      <button
        type="button"
        onClick={() =>
          toast.info(
            'Emoji picker',
            'Coming in a future release. For now type your favourite Unicode character 🎉',
          )
        }
        className="btn-ghost h-10 w-10"
        title="Emoji"
        aria-label="Insert emoji"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 10h.01M15 10h.01M9 14a4 4 0 006 0" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() =>
          toast.info('Attachments', 'File uploads are on the roadmap.')
        }
        className="btn-ghost h-10 w-10"
        title="Attach file"
        aria-label="Attach file"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 17.42a2 2 0 01-2.83-2.83l8.49-8.49" />
        </svg>
      </button>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Send a message…"
        aria-label="Message"
        className="flex-1 resize-none bg-transparent border-0 outline-none px-2 py-2.5 text-[15px] font-medium text-(--ink) placeholder:text-(--ink-subtle) leading-relaxed max-h-40"
      />

      <button
        type="submit"
        disabled={!hasContent}
        className={`h-10 w-10 rounded-xl flex items-center justify-center transition transform active:scale-95 ${
          hasContent
            ? 'bg-(--accent) text-(--accent-ink) hover:bg-(--accent-hover) shadow-soft'
            : 'bg-(--line-soft) text-(--ink-subtle) cursor-not-allowed'
        }`}
        title="Send (Enter)"
        aria-label="Send message"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M3.4 20.4l17.45-8.4a.5.5 0 0 0 0-.91L3.4 2.69a.5.5 0 0 0-.7.55l1.55 6.71L15 12 4.25 13.05l-1.55 6.79a.5.5 0 0 0 .7.56z" />
        </svg>
      </button>
    </form>
  );
}

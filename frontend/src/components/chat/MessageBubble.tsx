'use client';

import { formatTime } from '@/lib/utils';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const time = formatTime(message.timestamp || message.createdAt || '');

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2 px-4 group`}>
      <div
        className={`max-w-[80%] md:max-w-[70%] px-4 py-2.5 shadow-sm relative transition-all duration-200 group-hover:shadow-md ${
          isOwn
            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none shadow-indigo-100'
            : 'bg-white text-slate-800 rounded-2xl rounded-tl-none border border-slate-100'
        }`}
      >
        {!isOwn && message.senderName && (
          <p className="text-[10px] font-bold text-indigo-500 mb-1 uppercase tracking-widest">{message.senderName}</p>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-[14px] leading-relaxed font-medium break-words whitespace-pre-wrap">{message.content}</p>
          <div className="flex items-center justify-end gap-1.5 opacity-60">
            <span className={`text-[9px] font-bold uppercase tracking-tight ${isOwn ? 'text-indigo-100' : 'text-slate-400'}`}>
              {time}
            </span>
            {isOwn && (
              <span className={message.readBy?.length > 1 ? 'text-sky-300' : 'text-indigo-200'}>
                {message.readBy?.length > 1 ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M12.122 18.356l-1.107 1.107-8.205-8.205 1.107-1.107 7.098 7.098 13.903-13.903 1.107 1.107-15.003 15.003zm-10.405-7.098l1.107-1.107 1.107 1.107-1.107 1.107-1.107-1.107zm11.512 8.205l-1.107-1.107 9.346-9.345 1.108 1.107-9.347 9.345z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M12.122 18.356l-1.107 1.107-8.205-8.205 1.107-1.107 7.098 7.098 13.903-13.903 1.107 1.107-15.003 15.003z"/>
                  </svg>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

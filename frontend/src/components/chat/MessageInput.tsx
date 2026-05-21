'use client';

import { useState } from 'react';
import { getChatSocket } from '@/lib/socket';

interface MessageInputProps {
  roomId: string;
}

export default function MessageInput({ roomId }: MessageInputProps) {
  const [content, setContent] = useState('');

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    const socket = getChatSocket();
    socket.emit('send_message', { roomId, content: content.trim() });
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const handleTyping = () => {
    const socket = getChatSocket();
    socket.emit('typing', { roomId });
  };

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex items-center gap-1">
        <button 
          type="button" 
          onClick={() => alert('Emoji picker coming soon!')}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
          title="Emoji"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button 
          type="button" 
          onClick={() => alert('File attachment coming soon!')}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all duration-200"
          title="Attach"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.414a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
      </div>
      
      <form onSubmit={sendMessage} className="flex-1 flex gap-4">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleTyping}
          placeholder="Type a message..."
          className="flex-1 bg-slate-100 border-none rounded-xl py-3 px-5 text-[14px] font-medium text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all duration-200 outline-none"
        />
        
        {content.trim() ? (
          <button 
            type="submit" 
            className="w-12 h-12 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-all duration-200 shadow-md shadow-indigo-200 hover:scale-105 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        ) : (
          <button 
            type="button" 
            onClick={() => alert('Voice messages coming soon!')}
            className="w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center hover:bg-indigo-50 hover:text-indigo-600 transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}

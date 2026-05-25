'use client';

import { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="fixed inset-0 backdrop-blur-sm"
        style={{ background: 'var(--overlay)' }}
        onClick={onClose}
      />
      <div
        className={`relative bg-(--surface) rounded-2xl shadow-pop border border-(--line) w-full ${sizeClass[size]} overflow-hidden`}
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-3">
          <div>
            <h2
              id="modal-title"
              className="font-display text-lg font-bold tracking-tight text-(--ink)"
            >
              {title}
            </h2>
            {description && (
              <p className="text-sm text-(--ink-muted) mt-1">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-ghost -mr-1.5 -mt-1"
            aria-label="Close"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}

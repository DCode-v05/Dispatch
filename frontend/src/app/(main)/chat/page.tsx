export default function ChatPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-8 relative">
      <div className="text-center max-w-md animate-fade-in-up">
        <div className="relative mx-auto mb-6 h-24 w-24">
          <div
            aria-hidden
            className="absolute inset-0 rounded-3xl opacity-25 blur-2xl"
            style={{ background: 'var(--accent)' }}
          />
          <div className="relative h-full w-full rounded-3xl bg-(--surface) border border-(--line) flex items-center justify-center shadow-soft">
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 text-(--accent)"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-(--ink)">
          Pick a conversation
        </h1>
        <p className="mt-2 text-(--ink-muted) leading-relaxed">
          Choose a thread on the left to read messages, or invite someone new to
          start something fresh.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-(--ink-subtle)">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-(--positive)" />
            Realtime
          </span>
          <span className="opacity-30">·</span>
          <span>End-to-end auth</span>
          <span className="opacity-30">·</span>
          <span>Sent · Seen</span>
        </div>
      </div>
    </div>
  );
}

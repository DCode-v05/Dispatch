import ThemeToggle from '@/components/ui/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex relative overflow-hidden bg-(--canvas)">
      {/* Decorative side — visible on lg+ */}
      <div className="hidden lg:flex relative w-1/2 flex-col justify-between p-12 overflow-hidden bg-(--brand-bg)">
        {/* Layered gradient accent */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(60% 70% at 20% 10%, var(--accent) 0%, transparent 60%), radial-gradient(50% 60% at 90% 90%, color-mix(in oklab, var(--accent) 60%, transparent) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.04) 1px, transparent 0)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-(--accent) flex items-center justify-center shadow-pop">
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-white">Dispatch</span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl font-bold leading-tight text-white tracking-tight">
            Conversations that <span className="text-(--accent)">move</span> at the speed of your team.
          </p>
          <p className="mt-6 text-white/70 leading-relaxed">
            Built for real-time presence, group rooms, and the moments you actually want to remember.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 text-white/90">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs tracking-wider text-(--accent)">01</span>
              <span className="text-sm font-medium">Realtime</span>
              <span className="text-xs text-white/50">Sub-200ms delivery</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs tracking-wider text-(--accent)">02</span>
              <span className="text-sm font-medium">Presence</span>
              <span className="text-xs text-white/50">Heartbeat tracked</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs tracking-wider text-(--accent)">03</span>
              <span className="text-sm font-medium">Read receipts</span>
              <span className="text-xs text-white/50">Sent · Delivered · Seen</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
          v1.0 · realtime over websockets
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="absolute top-6 right-6 z-10">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-(--accent) flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-(--accent-ink)" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-(--ink)">Dispatch</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

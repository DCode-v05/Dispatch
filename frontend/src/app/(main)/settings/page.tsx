'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import Avatar from '@/components/ui/Avatar';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Modal from '@/components/ui/Modal';
import { toast } from '@/stores/toastStore';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { resolved } = useThemeStore();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-fade-in-up">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-(--accent) mb-2">
            Settings
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-(--ink)">
            Your account
          </h1>
          <p className="mt-2 text-(--ink-muted)">
            Personalise the experience and manage your session.
          </p>
        </div>

        {/* Profile */}
        <section className="card p-6 animate-fade-in-up">
          <div className="flex items-center gap-5">
            <Avatar
              name={user?.username || '?'}
              userId={user?.id}
              size="xl"
              showStatus
            />
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold tracking-tight text-(--ink)">
                {user?.username || 'Anonymous'}
              </h2>
              <p className="font-mono text-xs text-(--ink-muted) mt-0.5 truncate">
                {user?.email}
              </p>
              <p className="text-xs font-medium text-(--positive) mt-2 inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-(--positive)" />
                Online and reachable
              </p>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="card p-6 animate-fade-in-up">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-(--ink)">
                Appearance
              </h2>
              <p className="text-sm text-(--ink-muted) mt-0.5">
                Pick a side, or let your operating system decide.
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-(--ink-subtle) px-2 py-1 rounded-full bg-(--line-soft)">
              Now: {resolved}
            </span>
          </div>
          <ThemeToggle variant="segmented" />
        </section>

        {/* Notifications (placeholder) */}
        <section className="card p-6 animate-fade-in-up">
          <h2 className="font-display text-lg font-bold tracking-tight text-(--ink) mb-2">
            Notifications
          </h2>
          <p className="text-sm text-(--ink-muted) mb-4">
            Choose what should pull your attention.
          </p>
          <div className="space-y-3">
            {[
              { key: 'mentions', label: 'Direct mentions', desc: 'Always notify when someone @-mentions you.' },
              { key: 'dms', label: 'Direct messages', desc: 'Pop a toast when a 1:1 message arrives.' },
              { key: 'groups', label: 'Group activity', desc: 'Sounds & toasts for active group rooms.' },
            ].map((row) => (
              <label
                key={row.key}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-(--line-soft) hover:border-(--line) transition cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-(--ink)">{row.label}</p>
                  <p className="text-xs text-(--ink-muted) mt-0.5">{row.desc}</p>
                </div>
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={() =>
                    toast.info(
                      'Saved',
                      'Notification preferences will sync after the next reload.',
                    )
                  }
                  className="h-4 w-4 accent-(--accent) cursor-pointer"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Danger zone */}
        <section className="card p-6 animate-fade-in-up border-(--danger)/20">
          <h2 className="font-display text-lg font-bold tracking-tight text-(--danger) mb-2">
            Sign out
          </h2>
          <p className="text-sm text-(--ink-muted) mb-4">
            You&apos;ll need to log in again to access your messages on this
            device.
          </p>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="btn-secondary border-(--danger)/30 text-(--danger) hover:bg-(--danger-soft)"
          >
            Sign out
          </button>
        </section>
      </div>

      <Modal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Sign out?"
        description="See you next time."
        size="sm"
      >
        <div className="flex gap-3">
          <button
            onClick={() => setShowLogoutModal(false)}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleLogout}
            className="btn-primary flex-1"
            style={{ background: 'var(--danger)' }}
          >
            Sign out
          </button>
        </div>
      </Modal>
    </div>
  );
}

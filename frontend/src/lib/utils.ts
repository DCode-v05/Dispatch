export function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  // Force a stable 12-hour format with lowercase am/pm regardless of browser locale
  return date
    .toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}

/**
 * "5m" / "2h" / "yesterday" / "Mon" / "Mar 4"
 * Compact label for sidebar last-message timestamps.
 */
export function formatRelative(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (diff < minute) return 'now';
  if (diff < hour) return `${Math.floor(diff / minute)}m`;
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return `${Math.floor(diff / hour)}h`;
  }
  const yesterday = new Date(now - day);
  if (date.toDateString() === yesterday.toDateString()) return 'yest';
  if (diff < 7 * day) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '…';
}

export function getInitials(name: string): string {
  return name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Returns true if two dates fall on different calendar days. */
export function isDifferentDay(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return true;
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return true;
  return da.toDateString() !== db.toDateString();
}

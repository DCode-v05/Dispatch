'use client';

/**
 * Notification sound — synthesized via Web Audio API so we don't ship audio files.
 * A pleasant two-tone "ding" (~250ms).
 *
 * Browsers block audio until the user has interacted with the page; we lazily
 * create the AudioContext and `resume()` it on first interaction.
 */

let ctx: AudioContext | null = null;
let unlocked = false;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/**
 * Wire this up once on app mount — installs one-shot listeners that "unlock"
 * audio on the first user interaction so subsequent `playPing()` calls work.
 */
export function unlockAudioOnFirstInteraction(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (unlocked) return () => {};

  const unlock = () => {
    const c = ensureContext();
    if (c && c.state === 'suspended') {
      c.resume().catch(() => {});
    }
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };

  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
}

export function playPing(): void {
  const c = ensureContext();
  if (!c) return;
  if (c.state === 'suspended') {
    // Not yet unlocked by user interaction. Try to resume silently.
    c.resume().catch(() => {});
  }
  try {
    const now = c.currentTime;

    const osc1 = c.createOscillator();
    const gain1 = c.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc1.connect(gain1).connect(c.destination);
    osc1.start(now);
    osc1.stop(now + 0.18);

    const osc2 = c.createOscillator();
    const gain2 = c.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.09);
    gain2.gain.setValueAtTime(0.0001, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.14, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc2.connect(gain2).connect(c.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.28);
  } catch {
    // Audio errors should never break the app
  }
}

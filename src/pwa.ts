import { useEffect, useState } from 'react';

export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker registration failed', e));
  });
}

/**
 * Show a system notification. Android Chrome forbids `new Notification()` (it throws
 * "Illegal constructor"), so go through the service worker when there is one.
 * Never throws.
 */
export async function notify(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, { body, tag: 'scount-pending', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } else {
      new Notification(title, { body, tag: 'scount-pending' });
    }
  } catch (e) {
    console.warn('Notification failed', e);
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Install state for the "Install app" button. */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return {
    installed: isStandalone(),
    canPrompt: !!deferred,
    ios: isIos(),
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      force((n) => n + 1);
    },
  };
}

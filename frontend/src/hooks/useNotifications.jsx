import { useState, useEffect, useCallback, useRef } from 'react';

// Son de notification généré par code (pas besoin de fichier audio)
function createNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();

    return () => {
      try {
        // Note 1 : Do aigu
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.3);

        // Note 2 : Mi aigu (après 150ms)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
        gain2.gain.setValueAtTime(0, ctx.currentTime);
        gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.5);

        // Note 3 : Sol aigu (après 300ms)
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(1320, ctx.currentTime + 0.3);
        gain3.gain.setValueAtTime(0, ctx.currentTime);
        gain3.gain.setValueAtTime(0.25, ctx.currentTime + 0.3);
        gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(ctx.currentTime + 0.3);
        osc3.stop(ctx.currentTime + 0.7);
      } catch {}
    };
  } catch {
    return () => {};
  }
}

/**
 * Hook pour les notifications push PWA avec son.
 */
export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [swReady, setSwReady] = useState(false);
  const playSoundRef = useRef(null);

  // Enregistrer le Service Worker au montage
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => setSwReady(true))
        .catch(() => {});
    }
    // Préparer le son (doit être après une interaction utilisateur)
    const initSound = () => {
      if (!playSoundRef.current) {
        playSoundRef.current = createNotificationSound();
      }
      document.removeEventListener('click', initSound);
      document.removeEventListener('touchstart', initSound);
    };
    document.addEventListener('click', initSound, { once: true });
    document.addEventListener('touchstart', initSound, { once: true });
    return () => {
      document.removeEventListener('click', initSound);
      document.removeEventListener('touchstart', initSound);
    };
  }, []);

  // Demander la permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      // Initialiser le son après la permission
      if (!playSoundRef.current) {
        playSoundRef.current = createNotificationSound();
      }
      return result;
    } catch {
      return 'denied';
    }
  }, []);

  // Envoyer une notification avec son
  const notify = useCallback((title, options = {}) => {
    // Jouer le son (fonctionne même si la permission notif est refusée)
    playSoundRef.current?.();

    // Vibrer sur mobile
    navigator.vibrate?.([200, 100, 200]);

    if (permission !== 'granted') return;

    // Si le Service Worker est prêt, utiliser showNotification
    if (swReady && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          vibrate: [200, 100, 200],
          tag: options.tag || 'default',
          renotify: true,
          silent: false,
          ...options,
        });
      });
    } else {
      // Fallback: notification API directe
      try {
        new Notification(title, {
          icon: '/icon-192.svg',
          silent: false,
          ...options,
        });
      } catch {}
    }
  }, [permission, swReady]);

  return { permission, requestPermission, notify, swReady };
}

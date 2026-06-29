import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook pour les notifications push PWA avec son personnalisé.
 */
export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [swReady, setSwReady] = useState(false);
  const audioRef = useRef(null);

  // Enregistrer le Service Worker + préparer le son
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => setSwReady(true))
        .catch(() => {});
    }

    // Pré-charger le son de notification
    const audio = new Audio('/sounds/notification.mp3');
    audio.preload = 'auto';
    audio.volume = 1.0;
    audioRef.current = audio;
  }, []);

  // Demander la permission
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return 'denied';
    }
  }, []);

  // Jouer le son (max 3 secondes)
  const playSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
        // Arrêter après 3 secondes (c'est une notification, pas une chanson)
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }, 3000);
      }
    } catch {}
  }, []);

  // Stopper le son immédiatement
  const stopSound = useCallback(() => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } catch {}
  }, []);

  // Envoyer une notification avec son
  const notify = useCallback((title, options = {}) => {
    // Jouer le son (fonctionne même si la permission notif est refusée)
    playSound();

    // Vibrer sur mobile
    navigator.vibrate?.([200, 100, 200]);

    if (permission !== 'granted') return;

    // Service Worker notification (fonctionne en arrière-plan)
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
      try {
        new Notification(title, {
          icon: '/icon-192.svg',
          silent: false,
          ...options,
        });
      } catch {}
    }
  }, [permission, swReady, playSound]);

  return { permission, requestPermission, notify, playSound, stopSound, swReady };
}

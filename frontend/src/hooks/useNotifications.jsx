import { useState, useEffect, useCallback } from 'react';

/**
 * Hook pour les notifications push PWA.
 *
 * Usage:
 *   const { permission, requestPermission, notify } = useNotifications();
 *   notify('Nouvelle course !', { body: 'Un passager vous attend' });
 */
export function useNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );
  const [swReady, setSwReady] = useState(false);

  // Enregistrer le Service Worker au montage
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => setSwReady(true))
        .catch(() => {});
    }
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

  // Envoyer une notification
  const notify = useCallback((title, options = {}) => {
    if (permission !== 'granted') return;

    // Vibrer sur mobile
    navigator.vibrate?.([200, 100, 200]);

    // Si le Service Worker est prêt, utiliser showNotification (fonctionne en arrière-plan)
    if (swReady && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          tag: options.tag || 'default',
          renotify: true,
          ...options,
        });
      });
    } else {
      // Fallback: notification API directe
      new Notification(title, {
        icon: '/icon-192.png',
        ...options,
      });
    }
  }, [permission, swReady]);

  return { permission, requestPermission, notify, swReady };
}

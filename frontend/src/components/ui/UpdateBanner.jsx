import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Sparkles } from 'lucide-react';

/**
 * Bannière de mise à jour — s'affiche quand une nouvelle version est disponible.
 * Détecte via le Service Worker quand un nouveau build est prêt.
 */
export default function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Vérifier si un SW est en attente au chargement
    navigator.serviceWorker.ready.then(reg => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      // Écouter les futurs updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouvelle version prête !
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    });

    // Quand le nouveau SW prend le contrôle, recharger
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    // Vérifier les mises à jour toutes les 5 minutes
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then(reg => reg.update());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage('SKIP_WAITING');
    }
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed top-0 left-0 right-0 z-[300] px-3 pt-3"
        >
          <div className="max-w-md mx-auto bg-gradient-to-r from-brand-500 to-emerald-500 rounded-2xl shadow-lg p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Nouvelle version disponible !</p>
              <p className="text-white/70 text-xs">Mettez à jour pour les dernières fonctionnalités</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleUpdate}
              className="bg-white text-brand-600 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 flex-shrink-0"
            >
              <Download size={14} />
              MAJ
            </motion.button>
            <button
              onClick={() => setShowUpdate(false)}
              className="text-white/60 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

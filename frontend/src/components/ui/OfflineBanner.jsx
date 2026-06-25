import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[110] bg-red-600 text-white text-center overflow-hidden"
        >
          <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium">
            <WifiOff size={14} />
            Pas de connexion internet
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = {
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 border-green-200' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' },
  info: { icon: Info, color: 'text-brand-500', bg: 'bg-brand-50 border-brand-200' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {/* Rendu des toasts */}
      <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center px-4 pt-[env(safe-area-inset-top,12px)]">
        <AnimatePresence>
          {toasts.map((toast) => {
            const config = ICONS[toast.type] || ICONS.info;
            const Icon = config.icon;
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={`pointer-events-auto w-full max-w-sm mt-2 px-4 py-3 rounded-2xl border shadow-card flex items-center gap-3 ${config.bg}`}
              >
                <Icon size={20} className={config.color} />
                <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
                <button onClick={() => dismiss(toast.id)} className="p-0.5 rounded-lg hover:bg-black/5">
                  <X size={14} className="text-gray-400" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

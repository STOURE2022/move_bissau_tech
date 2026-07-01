import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

const defaultIcons = {
  danger: AlertTriangle,
  warning: AlertCircle,
  info: Info,
  success: CheckCircle,
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  icon: CustomIcon,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const variants = {
    danger: { iconBg: 'bg-red-50', iconColor: 'text-red-500', btnColor: 'bg-red-500 hover:bg-red-600' },
    warning: { iconBg: 'bg-yellow-50', iconColor: 'text-yellow-500', btnColor: 'bg-yellow-500 hover:bg-yellow-600' },
    info: { iconBg: 'bg-brand-50', iconColor: 'text-brand-500', btnColor: 'bg-brand-500 hover:bg-brand-600' },
    success: { iconBg: 'bg-green-50', iconColor: 'text-green-500', btnColor: 'bg-green-500 hover:bg-green-600' },
  };
  const { t } = useTranslation();
  const v = variants[variant] || variants.danger;
  const Icon = CustomIcon || defaultIcons[variant] || AlertTriangle;
  const finalConfirmLabel = confirmLabel || t('common.confirm');
  const finalCancelLabel = cancelLabel || t('common.cancel');

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onCancel}
          />

          {/* Modale */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 30 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center"
          >
            <div className={`w-16 h-16 ${v.iconBg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
              <Icon size={32} className={v.iconColor} />
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl border-2 border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
              >
                {finalCancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 py-3.5 rounded-2xl font-semibold text-white transition shadow-sm disabled:opacity-50 ${v.btnColor}`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : finalConfirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

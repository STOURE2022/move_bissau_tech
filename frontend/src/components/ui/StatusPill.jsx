import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useTranslation } from '../../i18n/useTranslation';

const statusConfig = {
  driver_assigned:   { color: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500' },
  driver_en_route:   { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  driver_arrived:    { color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
  passenger_onboard: { color: 'bg-brand-100 text-brand-700', dot: 'bg-brand-500' },
  completed:         { color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  paid:              { color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled:         { color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  pending:           { color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  online:            { color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  offline:           { color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

export default function StatusPill({ status }) {
  const { t } = useTranslation();
  const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  const label = t(`status.${status}`, status);

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={clsx('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', config.color)}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', config.dot)} />
      {label}
    </motion.span>
  );
}

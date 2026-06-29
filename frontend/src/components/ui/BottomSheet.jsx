import { motion } from 'framer-motion';

export default function BottomSheet({ children, className = '' }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`absolute bottom-0 left-0 right-0 bg-white z-30 rounded-t-[1.75rem] shadow-[0_-4px_30px_rgba(0,0,0,0.08)] ${className}`}
      style={{ maxHeight: '70vh' }}
    >
      {/* Poignée de tirage */}
      <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-white rounded-t-[1.75rem] z-10">
        <div className="w-9 h-1 bg-gray-200 rounded-full" />
      </div>
      <div className="px-5 pb-24 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 24px)' }}>
        {children}
      </div>
    </motion.div>
  );
}

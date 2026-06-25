import { motion, AnimatePresence } from 'framer-motion';

export default function BottomSheet({ children, className = '' }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`absolute bottom-0 left-0 right-0 bg-white bottom-sheet z-30 ${className}`}
    >
      {/* Poignée de tirage */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      <div className="px-5 pb-8">
        {children}
      </div>
    </motion.div>
  );
}

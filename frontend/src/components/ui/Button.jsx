import clsx from 'clsx';
import { motion } from 'framer-motion';

const variants = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-md',
  secondary: 'bg-white text-brand-500 border-2 border-brand-500 hover:bg-brand-50 active:bg-brand-100',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200',
  gold: 'bg-gold text-brand-800 hover:bg-yellow-400 active:bg-yellow-500 shadow-md',
};

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-xl',
  md: 'px-6 py-3.5 text-base rounded-2xl',
  lg: 'px-8 py-4 text-lg rounded-2xl',
  full: 'px-6 py-4 text-base rounded-2xl w-full',
};

export default function Button({
  children, variant = 'primary', size = 'full',
  loading, disabled, icon: Icon, className, ...props
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={clsx(
        'font-semibold transition-all duration-200 flex items-center justify-center gap-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={20} />}
          {children}
        </>
      )}
    </motion.button>
  );
}

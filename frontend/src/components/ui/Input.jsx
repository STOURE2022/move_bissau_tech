import clsx from 'clsx';

export default function Input({
  label, icon: Icon, error, className, ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-sm font-medium text-gray-600 pl-1">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon size={20} />
          </div>
        )}
        <input
          className={clsx(
            'w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5',
            'text-gray-800 placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500',
            'transition-all duration-200',
            Icon && 'pl-12',
            error && 'border-red-400 focus:ring-red-400/30',
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="text-red-500 text-xs pl-1">{error}</p>}
    </div>
  );
}

import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Wallet, Clock, User } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export default function DriverNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const tabs = [
    { path: '/driver', icon: Home, label: t('nav.home') },
    { path: '/driver/credit', icon: Wallet, label: t('nav.credit') },
    { path: '/driver/history', icon: Clock, label: t('nav.history') },
    { path: '/driver/profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-gray-100 z-50 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {tabs.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="flex-1 flex flex-col items-center py-2.5 relative"
            >
              {active && (
                <motion.div
                  layoutId="driver-tab-indicator"
                  className="absolute -top-px left-4 right-4 h-0.5 bg-brand-500 rounded-full"
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
              <tab.icon
                size={22}
                className={`transition-colors ${active ? 'text-brand-500' : 'text-gray-400'}`}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span className={`text-[10px] mt-1 font-medium transition-colors ${
                active ? 'text-brand-500' : 'text-gray-400'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

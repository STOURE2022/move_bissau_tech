import { useNavigate, useLocation } from 'react-router-dom';
import { Home, MapPin, Clock, User } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/my-rides', icon: MapPin, label: 'Courses' },
  { path: '/history', icon: Clock, label: 'Historique' },
  { path: '/profile', icon: User, label: 'Profil' },
];

export default function PassengerNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const hiddenPaths = ['/request', '/offers', '/tracking', '/payment', '/rate', '/welcome', '/login', '/register', '/forgot', '/otp', '/complete', '/driver'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-3 mb-3 bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-white/50">
        <div className="flex items-center justify-around py-1">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center gap-0.5 py-2.5 px-5 transition-all"
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-x-2 top-1 bottom-1 bg-brand-50 rounded-xl"
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  />
                )}
                <item.icon
                  size={20}
                  className={`relative z-10 transition-colors ${isActive ? 'text-brand-600' : 'text-gray-400'}`}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className={`relative z-10 text-[10px] transition-colors ${
                  isActive ? 'font-bold text-brand-600' : 'font-medium text-gray-400'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Clock, MapPin, User } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Accueil' },
  { path: '/my-rides', icon: MapPin, label: 'Courses' },
  { path: '/history', icon: Clock, label: 'Historique' },
  { path: '/profile', icon: User, label: 'Profil' },
];

export default function PassengerNav() {
  const navigate = useNavigate();
  const location = useLocation();

  // Ne pas afficher sur certaines pages (tracking, payment, request, etc.)
  const hiddenPaths = ['/request', '/offers', '/tracking', '/payment', '/rate', '/welcome', '/login', '/register'];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 py-2 px-4 transition-colors ${
                isActive ? 'text-brand-500' : 'text-gray-400'
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 bg-brand-500 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle, AlertTriangle, Wallet, Star, Info } from 'lucide-react';
import api from '../../api/client';

const typeConfig = {
  ride_status:  { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
  credit_low:   { icon: Wallet, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  credit_topup: { icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-50' },
  rating:       { icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  incident:     { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50' },
  system:       { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
  ride_request: { icon: Info, color: 'text-green-500', bg: 'bg-green-50' },
  ride_offer:   { icon: Info, color: 'text-green-500', bg: 'bg-green-50' },
  payment:      { icon: Wallet, color: 'text-green-500', bg: 'bg-green-50' },
};

export default function NotifBell() {
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifs.filter(n => !n.is_read).length;

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 20000);
    return () => clearInterval(interval);
  }, []);

  // Fermer si clic extérieur
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const loadNotifs = async () => {
    try {
      // On utilise un endpoint custom ou on simule avec les données existantes
      // Pour le MVP, on crée des notifs depuis le profil chauffeur
      const profile = await api.get('/drivers/me');
      const credit = await api.get('/commissions/balance').catch(() => null);

      const generated = [];

      // Notif vérification
      if (profile.verification_status === 'approved') {
        generated.push({
          id: 'verif-ok',
          title: 'Dossier approuvé !',
          body: 'Votre dossier a été validé. Vous pouvez maintenant recevoir des courses.',
          notification_type: 'system',
          is_read: true,
          created_at: profile.created_at,
        });
      } else if (profile.verification_status === 'rejected') {
        generated.push({
          id: 'verif-ko',
          title: 'Dossier rejeté',
          body: profile.rejection_reason || 'Veuillez resoumettre vos documents.',
          notification_type: 'incident',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      } else if (profile.verification_status === 'pending') {
        generated.push({
          id: 'verif-pending',
          title: 'Dossier en cours de vérification',
          body: 'Notre équipe vérifie vos documents. Vous serez notifié.',
          notification_type: 'system',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      // Notif crédit bas
      if (credit && !credit.has_sufficient_credit) {
        generated.push({
          id: 'credit-low',
          title: 'Crédit insuffisant',
          body: `Votre solde est de ${credit.balance} F. Rechargez pour recevoir des courses.`,
          notification_type: 'credit_low',
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      // Documents rejetés
      if (profile.documents) {
        profile.documents.filter(d => d.status === 'rejected').forEach(doc => {
          generated.push({
            id: `doc-rejected-${doc.id}`,
            title: `Document refusé : ${doc.doc_type}`,
            body: doc.rejection_reason || 'Veuillez resoumettre ce document.',
            notification_type: 'incident',
            is_read: false,
            created_at: doc.reviewed_at || doc.created_at,
          });
        });
      }

      // Documents approuvés
      if (profile.documents) {
        profile.documents.filter(d => d.status === 'approved').forEach(doc => {
          generated.push({
            id: `doc-approved-${doc.id}`,
            title: `Document validé : ${doc.doc_type}`,
            body: 'Votre document a été approuvé.',
            notification_type: 'ride_status',
            is_read: true,
            created_at: doc.reviewed_at || doc.created_at,
          });
        });
      }

      setNotifs(generated);
    } catch {}
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    return `Il y a ${Math.floor(hours / 24)}j`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bouton cloche */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="relative p-2"
      >
        <Bell size={22} className="text-white/80" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm"
          >
            {unreadCount}
          </motion.span>
        )}
      </motion.button>

      {/* Panel de notifications */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-elevated border border-gray-200 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} nouvelle{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Liste */}
            <div className="max-h-80 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">Aucune notification</p>
                </div>
              ) : (
                notifs.map((n, i) => {
                  const cfg = typeConfig[n.notification_type] || typeConfig.system;
                  const Icon = cfg.icon;
                  return (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition ${
                        !n.is_read ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                          <Icon size={14} className={cfg.color} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.is_read && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

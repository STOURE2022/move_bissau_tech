import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, Receipt, X } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import RideReceipt from '../../components/ui/RideReceipt';
import { useTranslation } from '../../i18n/useTranslation';

export default function HistoryPage() {
  const { t, lang } = useTranslation();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [receiptRide, setReceiptRide] = useState(null);
  const navigate = useNavigate();
  const { isDriver } = useAuth();

  const statusLabels = {
    paid: { text: t('historyPage.statusPaid'), color: 'bg-green-100 text-green-700' },
    completed: { text: t('historyPage.statusCompleted'), color: 'bg-blue-100 text-blue-700' },
    cancelled: { text: t('historyPage.statusCancelled'), color: 'bg-red-100 text-red-700' },
  };

  const FILTERS = [
    { id: 'all', label: t('historyPage.all') },
    { id: 'done', label: t('historyPage.completed') },
    { id: 'cancelled', label: t('historyPage.cancelled') },
  ];

  function groupByMonth(rides) {
    const groups = {};
    rides.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString(lang === 'pt' ? 'pt' : 'fr', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { label, rides: [] };
      groups[key].rides.push(r);
    });
    return Object.values(groups);
  }

  useEffect(() => {
    api.get('/rides/history').then(data => {
      setRides(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = rides.filter(r => {
    if (filter === 'done') return ['paid', 'completed'].includes(r.status);
    if (filter === 'cancelled') return r.status === 'cancelled';
    return true;
  });

  const groups = groupByMonth(filtered);

  const rebook = (ride) => {
    navigate('/request', { state: {
      presetDropoff: ride.dropoff_lat && ride.dropoff_lng ? [ride.dropoff_lat, ride.dropoff_lng] : null,
      presetDropoffAddress: ride.dropoff_address,
      vehicleType: ride.vehicle_type,
    }});
  };

  // Stats rapides
  const totalRides = rides.filter(r => ['paid', 'completed'].includes(r.status)).length;
  const totalSpent = rides.filter(r => ['paid', 'completed'].includes(r.status))
    .reduce((sum, r) => sum + (r.agreed_price || 0), 0);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500 to-emerald-500 px-5 pt-8 pb-6">
        <h1 className="text-white text-xl font-bold">{t('historyPage.title')}</h1>
        <div className="flex gap-4 mt-3">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 flex-1 text-center">
            <p className="text-white/70 text-[10px]">{t('historyPage.totalRides')}</p>
            <p className="text-white font-bold text-lg">{totalRides}</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 flex-1 text-center">
            <p className="text-white/70 text-[10px]">{t('historyPage.totalSpent')}</p>
            <p className="text-white font-bold text-lg">{totalSpent.toLocaleString()} F</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3">
        {/* Filtres */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1 mb-4">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                filter === f.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
                <div className="h-3 w-3/4 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🏍️</p>
            <p className="text-gray-500">{t('historyPage.noRides')}{filter !== 'all' ? ` ${t('historyPage.inThisCategory')}` : ''}</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.rides.map((ride, i) => {
                  const status = statusLabels[ride.status] || { text: ride.status, color: 'bg-gray-100 text-gray-600' };
                  const canRebook = !isDriver && (ride.status === 'paid' || ride.status === 'completed');
                  const dateStr = new Date(ride.created_at).toLocaleDateString(lang === 'pt' ? 'pt' : 'fr', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                  });

                  return (
                    <motion.div
                      key={ride.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-2xl shadow-sm overflow-hidden"
                    >
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center">
                              <span className="text-base">{ride.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                            </div>
                            <div>
                              <span className="font-bold text-gray-800">{ride.agreed_price} F</span>
                              <p className="text-[10px] text-gray-400">{dateStr}</p>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${status.color}`}>
                            {status.text}
                          </span>
                        </div>

                        {/* Trajet compact */}
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full flex-shrink-0" />
                          <span className="truncate">{ride.pickup_address || t('receipt.departure')}</span>
                          <span className="text-gray-300">→</span>
                          <span className="truncate">{ride.dropoff_address || t('receipt.arrival')}</span>
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                        </div>

                        {/* Actions */}
                        {canRebook && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setReceiptRide(ride)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
                            >
                              <Receipt size={12} /> {t('historyPage.receipt')}
                            </button>
                            <button
                              onClick={() => rebook(ride)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-brand-50 rounded-xl text-xs font-semibold text-brand-600 hover:bg-brand-100 transition"
                            >
                              <RefreshCw size={12} /> {t('historyPage.rebook')}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal reçu */}
      <AnimatePresence>
        {receiptRide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setReceiptRide(null)}
          >
            <div onClick={e => e.stopPropagation()}>
              <RideReceipt ride={receiptRide} onClose={() => setReceiptRide(null)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

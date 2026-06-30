import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, TrendingUp, Car } from 'lucide-react';
import api from '../../api/client';
import { useDriverStats } from '../../hooks/useDriverStats';
import DriverNav from '../../components/layout/DriverNav';
import WeeklyChart from '../../components/driver/WeeklyChart';
import { useTranslation } from '../../i18n/useTranslation';

export default function DriverHistoryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const stats = useDriverStats(false);

  const statusConfig = {
    paid:      { text: t('historyPage.statusPaid', 'Payée'), color: 'bg-green-100 text-green-700' },
    completed: { text: t('historyPage.statusCompleted', 'Terminée'), color: 'bg-blue-100 text-blue-700' },
    cancelled: { text: t('historyPage.statusCancelled', 'Annulée'), color: 'bg-red-100 text-red-700' },
  };

  useEffect(() => {
    api.get('/rides/history')
      .then(data => setRides(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? rides : rides.filter(r => r.status === filter);

  // Calcul des stats
  const paidRides = rides.filter(r => r.status === 'paid');
  const totalEarnings = paidRides.reduce((sum, r) => sum + r.agreed_price, 0);
  const totalCommission = paidRides.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white px-5 pt-5 pb-4 border-b">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">{t('historyPage.title', 'Historique')}</h2>
        </div>

        {/* Stats résumé */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: t('driver.ridesCount', 'Courses'), value: paidRides.length, icon: Car, color: 'bg-brand-50 text-brand-600' },
            { label: t('driver.revenue', 'Revenus'), value: `${totalEarnings} F`, icon: TrendingUp, color: 'bg-green-50 text-green-600' },
            { label: t('driver.commission', 'Commission'), value: `${totalCommission} F`, icon: Calendar, color: 'bg-orange-50 text-orange-600' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 text-center ${s.color.split(' ')[0]}`}>
              <s.icon size={16} className={`mx-auto ${s.color.split(' ')[1]}`} />
              <p className={`font-bold text-sm mt-1 ${s.color.split(' ')[1]}`}>{s.value}</p>
              <p className="text-[10px] text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { id: 'all', label: t('historyPage.all', 'Toutes') },
            { id: 'paid', label: t('driver.filterPaid', 'Payées') },
            { id: 'completed', label: t('historyPage.completed', 'Terminées') },
            { id: 'cancelled', label: t('historyPage.cancelled', 'Annulées') },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filter === f.id
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Graphique semaine */}
      <div className="px-5 pt-4">
        <WeeklyChart
          data={stats.weeklyData}
          maxValue={stats.weeklyMax}
          weeklyTotal={stats.weeklyTotal}
          weeklyRides={stats.weeklyRides}
        />
      </div>

      {/* Liste */}
      <div className="px-5 py-4 space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-gray-500 font-medium">{t('historyPage.noRides', 'Aucune course')}</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter !== 'all' ? t('driver.tryAnotherFilter', 'Essayez un autre filtre') : t('driver.ridesWillAppear', 'Vos courses apparaîtront ici')}
            </p>
          </div>
        ) : (
          filtered.map((ride, i) => {
            const status = statusConfig[ride.status] || { text: ride.status, color: 'bg-gray-100 text-gray-600' };
            return (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-2xl p-4 shadow-soft"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ride.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                    <span className="font-bold text-gray-800">{ride.agreed_price} F</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${status.color}`}>
                    {status.text}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-gray-500">
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-brand-500 rounded-full flex-shrink-0" />
                    <span className="truncate">{ride.pickup_address || t('receipt.departure', 'Départ')}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0" />
                    <span className="truncate">{ride.dropoff_address || t('receipt.arrival', 'Arrivée')}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <p className="text-[10px] text-gray-400">
                    {new Date(ride.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {ride.commission_amount > 0 && (
                    <p className="text-[10px] text-orange-500 font-medium">
                      {t('driver.commission', 'Commission')} : {ride.commission_amount} F
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <DriverNav />
    </div>
  );
}

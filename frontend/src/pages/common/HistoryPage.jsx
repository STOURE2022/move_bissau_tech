import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

const statusLabels = {
  paid: { text: 'Payée', color: 'bg-green-100 text-green-700' },
  completed: { text: 'Terminée', color: 'bg-blue-100 text-blue-700' },
  cancelled: { text: 'Annulée', color: 'bg-red-100 text-red-700' },
};

const FILTERS = [
  { id: 'all', label: 'Toutes' },
  { id: 'done', label: 'Terminées' },
  { id: 'cancelled', label: 'Annulées' },
];

function groupByMonth(rides) {
  const groups = {};
  rides.forEach(r => {
    const d = new Date(r.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, rides: [] };
    groups[key].rides.push(r);
  });
  return Object.values(groups);
}

export default function HistoryPage() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const { isDriver } = useAuth();

  useEffect(() => {
    api.get('/rides/history').then(setRides).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = rides.filter(r => {
    if (filter === 'done') return r.status === 'paid' || r.status === 'completed';
    if (filter === 'cancelled') return r.status === 'cancelled';
    return true;
  });

  const groups = groupByMonth(filtered);

  const rebook = (ride) => {
    navigate('/request', {
      state: {
        presetDropoff: ride.dropoff_lat ? [ride.dropoff_lat, ride.dropoff_lng] : null,
        presetDropoffAddress: ride.dropoff_address,
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      <div className="bg-white px-5 pt-5 pb-4 flex items-center gap-3 border-b">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h2 className="text-lg font-bold flex-1">Historique</h2>
        <span className="text-sm text-gray-400">{rides.length} courses</span>
      </div>

      {/* Filtres */}
      <div className="px-5 pt-3 pb-1 flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              filter === f.id
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-soft animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-3/4 bg-gray-100 rounded" />
                  <div className="h-3 w-2/3 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🏍️</p>
            <p className="text-gray-500">Aucune course{filter !== 'all' ? ' dans cette catégorie' : ''}</p>
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.rides.map((ride, i) => {
                  const status = statusLabels[ride.status] || { text: ride.status, color: 'bg-gray-100 text-gray-600' };
                  const canRebook = !isDriver && (ride.status === 'paid' || ride.status === 'completed');

                  return (
                    <motion.div
                      key={ride.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-2xl p-4 shadow-soft"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{ride.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                          <span className="font-bold text-gray-800">{ride.agreed_price} F</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                          {status.text}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                          {ride.pickup_address || 'Départ'}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                          {ride.dropoff_address || 'Arrivée'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-[10px] text-gray-400">
                          {new Date(ride.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {canRebook && (
                          <button
                            onClick={() => rebook(ride)}
                            className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:text-brand-700 transition"
                          >
                            <RefreshCw size={12} />
                            Refaire
                          </button>
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
    </div>
  );
}

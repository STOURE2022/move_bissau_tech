import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, X, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../components/ui/Toast';

export default function MyRidesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeRequest, setActiveRequest] = useState(null);
  const [activeRides, setActiveRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      // Demande en cours
      try {
        const req = await api.get('/rides/requests/active');
        if (req && req.id) setActiveRequest(req);
        else setActiveRequest(null);
      } catch { setActiveRequest(null); }

      // Courses actives
      try {
        const rides = await api.get('/rides/history?status=active');
        setActiveRides(rides?.results || []);
      } catch { setActiveRides([]); }
    } finally { setLoading(false); }
  };

  const cancelRequest = async (id) => {
    setCancelling(id);
    try {
      await api.post(`/rides/requests/${id}/cancel`);
      setActiveRequest(null);
      toast.show('Demande annulée', 'success');
    } catch (e) {
      toast.show(e.message || 'Erreur', 'error');
    }
    setCancelling(null);
  };

  const cancelRide = async (id) => {
    if (!confirm('Annuler la course ? Des frais peuvent s\'appliquer.')) return;
    setCancelling(id);
    try {
      await api.post(`/rides/${id}/cancel`, { reason: 'Annulé par le passager' });
      loadData();
      toast.show('Course annulée', 'success');
    } catch (e) {
      toast.show(e.message || 'Erreur', 'error');
    }
    setCancelling(null);
  };

  const statusLabels = {
    pending: { text: 'En attente', color: 'bg-yellow-100 text-yellow-700', emoji: '⏳' },
    offers_received: { text: 'Offres reçues', color: 'bg-blue-100 text-blue-700', emoji: '💬' },
    driver_assigned: { text: 'Chauffeur assigné', color: 'bg-brand-100 text-brand-700', emoji: '🚀' },
    driver_en_route: { text: 'En route', color: 'bg-brand-100 text-brand-700', emoji: '🏍️' },
    driver_arrived: { text: 'Arrivé', color: 'bg-green-100 text-green-700', emoji: '📍' },
    passenger_onboard: { text: 'En course', color: 'bg-green-100 text-green-700', emoji: '🛣️' },
    completed: { text: 'À payer', color: 'bg-orange-100 text-orange-700', emoji: '💰' },
  };

  const hasItems = activeRequest || activeRides.length > 0;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-800">Mes courses</h1>
        <p className="text-xs text-gray-400 mt-0.5">Gérez vos trajets en cours</p>
      </div>

      <div className="px-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-brand-500 animate-spin" />
          </div>
        ) : !hasItems ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto flex items-center justify-center mb-4">
              <MapPin size={32} className="text-gray-300" />
            </div>
            <h3 className="font-bold text-gray-700 text-lg">Aucune course active</h3>
            <p className="text-gray-400 text-sm mt-1 mb-6">Commandez un trajet pour commencer</p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/')}
              className="bg-brand-500 text-white font-bold px-8 py-3 rounded-2xl shadow-sm mx-auto"
            >
              Commander un trajet
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Demande en cours */}
            {activeRequest && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-white font-semibold text-sm">Demande en attente</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    statusLabels[activeRequest.status]?.color || 'bg-gray-100 text-gray-600'
                  }`}>
                    {statusLabels[activeRequest.status]?.text || activeRequest.status}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex gap-3 mb-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                      <div className="w-0.5 h-5 bg-gray-200 my-0.5" />
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <p className="text-sm text-gray-700 line-clamp-1">{activeRequest.pickup_address || 'Ma position'}</p>
                      <p className="text-sm text-gray-700 line-clamp-1">{activeRequest.dropoff_address}</p>
                    </div>
                    <p className="font-bold text-brand-600 text-lg">{activeRequest.proposed_price} F</p>
                  </div>

                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(`/offers/${activeRequest.id}`)}
                      className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1"
                    >
                      {activeRequest.status === 'offers_received' ? 'Voir les offres' : 'Suivre'}
                      <ChevronRight size={14} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => cancelRequest(activeRequest.id)}
                      disabled={cancelling === activeRequest.id}
                      className="px-4 py-2.5 border border-red-200 text-red-500 font-semibold rounded-xl text-sm hover:bg-red-50 transition disabled:opacity-50"
                    >
                      {cancelling === activeRequest.id ? '...' : 'Annuler'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Courses actives */}
            {activeRides.map((ride, i) => {
              const status = statusLabels[ride.status] || { text: ride.status, color: 'bg-gray-100 text-gray-600', emoji: '⏳' };
              const canCancel = ['driver_assigned', 'driver_en_route', 'driver_arrived'].includes(ride.status);

              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-brand-500 to-emerald-500 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{status.emoji}</span>
                      <span className="text-white font-semibold text-sm">{status.text}</span>
                    </div>
                    <span className="text-white/80 text-xs font-mono">
                      {ride.agreed_price} F
                    </span>
                  </div>

                  <div className="p-4">
                    {/* Chauffeur */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                        <span className="text-lg">{ride.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 text-sm">{ride.driver_name}</p>
                        {ride.driver_vehicle && (
                          <p className="text-xs text-gray-400">
                            {ride.driver_vehicle.brand} {ride.driver_vehicle.model}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Trajet */}
                    <div className="flex gap-3 mb-3">
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-2 h-2 rounded-full bg-brand-500" />
                        <div className="w-0.5 h-4 bg-gray-200 my-0.5" />
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs text-gray-500 line-clamp-1">{ride.pickup_address}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{ride.dropoff_address}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (ride.status === 'completed') navigate(`/payment/${ride.id}`);
                          else navigate(`/tracking/${ride.id}`);
                        }}
                        className="flex-1 bg-brand-500 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1"
                      >
                        {ride.status === 'completed' ? 'Payer' : 'Suivre le trajet'}
                        <ChevronRight size={14} />
                      </motion.button>
                      {canCancel && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => cancelRide(ride.id)}
                          disabled={cancelling === ride.id}
                          className="px-4 py-2.5 border border-red-200 text-red-500 font-semibold rounded-xl text-sm hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {cancelling === ride.id ? '...' : 'Annuler'}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ChevronRight, Loader2, Navigation, X } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../components/ui/Toast';

const STATUS_CONFIG = {
  pending:           { text: 'En attente',       color: 'bg-amber-500',  emoji: '⏳' },
  offers_received:   { text: 'Offres reçues',    color: 'bg-blue-500',   emoji: '💬' },
  driver_assigned:   { text: 'Chauffeur trouvé', color: 'bg-brand-500',  emoji: '🚀' },
  driver_en_route:   { text: 'En route',         color: 'bg-brand-500',  emoji: '🏍️' },
  driver_arrived:    { text: 'Arrivé',           color: 'bg-green-500',  emoji: '📍' },
  passenger_onboard: { text: 'En course',        color: 'bg-green-500',  emoji: '🛣️' },
  completed:         { text: 'À payer',          color: 'bg-orange-500', emoji: '💰' },
};

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
      try {
        const req = await api.get('/rides/requests/active');
        setActiveRequest(req?.id ? req : null);
      } catch { setActiveRequest(null); }
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
    } catch (e) { toast.show(e.message || 'Erreur', 'error'); }
    setCancelling(null);
  };

  const cancelRide = async (id) => {
    if (!confirm('Annuler la course ? Des frais peuvent s\'appliquer.')) return;
    setCancelling(id);
    try {
      await api.post(`/rides/${id}/cancel`, { reason: 'Annulé par le passager' });
      loadData();
      toast.show('Course annulée', 'success');
    } catch (e) { toast.show(e.message || 'Erreur', 'error'); }
    setCancelling(null);
  };

  const hasItems = activeRequest || activeRides.length > 0;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-500 to-emerald-500 px-5 pt-8 pb-6">
        <h1 className="text-white text-xl font-bold">Mes courses</h1>
        <p className="text-white/70 text-xs mt-0.5">Gérez vos trajets en temps réel</p>
      </div>

      <div className="px-4 -mt-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="text-brand-500 animate-spin" />
          </div>
        ) : !hasItems ? (
          /* État vide */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-sm p-8 text-center"
          >
            <div className="w-20 h-20 bg-brand-50 rounded-full mx-auto flex items-center justify-center mb-5">
              <Navigation size={32} className="text-brand-400" />
            </div>
            <h3 className="font-bold text-gray-800 text-lg">Aucune course active</h3>
            <p className="text-gray-400 text-sm mt-1 mb-6">Commandez un trajet pour commencer</p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold px-8 py-3.5 rounded-2xl shadow-sm mx-auto"
            >
              Commander un trajet
            </motion.button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {/* Demande en cours */}
            <AnimatePresence>
              {activeRequest && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-white rounded-3xl shadow-sm overflow-hidden"
                >
                  {/* Barre statut */}
                  <div className={`${STATUS_CONFIG[activeRequest.status]?.color || 'bg-gray-500'} px-4 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span>{STATUS_CONFIG[activeRequest.status]?.emoji}</span>
                      <span className="text-white font-semibold text-sm">
                        {STATUS_CONFIG[activeRequest.status]?.text || activeRequest.status}
                      </span>
                    </div>
                    <span className="text-white/80 text-xs font-bold">{activeRequest.proposed_price} F</span>
                  </div>

                  <div className="p-4">
                    {/* Trajet */}
                    <div className="flex gap-3 mb-4">
                      <div className="flex flex-col items-center pt-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-brand-500 ring-2 ring-brand-100" />
                        <div className="w-0.5 h-6 bg-gray-200 my-0.5" />
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-100" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{activeRequest.pickup_address || 'Ma position'}</p>
                        <p className="text-sm font-medium text-gray-800 line-clamp-1">{activeRequest.dropoff_address}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate(`/offers/${activeRequest.id}`)}
                        className="flex-1 bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {activeRequest.status === 'offers_received' ? 'Voir les offres' : 'Suivre'}
                        <ChevronRight size={14} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => cancelRequest(activeRequest.id)}
                        disabled={cancelling === activeRequest.id}
                        className="w-12 border-2 border-red-200 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-50 transition disabled:opacity-50"
                      >
                        {cancelling === activeRequest.id ? '...' : <X size={16} />}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Courses actives */}
            {activeRides.map((ride, i) => {
              const status = STATUS_CONFIG[ride.status] || { text: ride.status, color: 'bg-gray-500', emoji: '⏳' };
              const canCancel = ['driver_assigned', 'driver_en_route', 'driver_arrived'].includes(ride.status);

              return (
                <motion.div
                  key={ride.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-3xl shadow-sm overflow-hidden"
                >
                  <div className={`${status.color} px-4 py-2 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <span>{status.emoji}</span>
                      <span className="text-white font-semibold text-sm">{status.text}</span>
                    </div>
                    <span className="text-white font-bold text-sm">{ride.agreed_price} F</span>
                  </div>

                  <div className="p-4">
                    {/* Chauffeur */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 bg-brand-50 rounded-2xl flex items-center justify-center overflow-hidden">
                        {ride.driver_avatar ? (
                          <img src={ride.driver_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{ride.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 text-sm">{ride.driver_name}</p>
                        {ride.driver_vehicle && (
                          <p className="text-[11px] text-gray-400">
                            {ride.driver_vehicle.brand} {ride.driver_vehicle.model}
                            {ride.driver_vehicle.plate && ` · ${ride.driver_vehicle.plate}`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Trajet compact */}
                    <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
                      <span className="truncate flex-1">{ride.pickup_address}</span>
                      <span className="text-gray-300">→</span>
                      <span className="truncate flex-1">{ride.dropoff_address}</span>
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (ride.status === 'completed') navigate(`/payment/${ride.id}`);
                          else navigate(`/tracking/${ride.id}`);
                        }}
                        className="flex-1 bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {ride.status === 'completed' ? '💰 Payer' : '📍 Suivre le trajet'}
                      </motion.button>
                      {canCancel && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => cancelRide(ride.id)}
                          disabled={cancelling === ride.id}
                          className="w-12 border-2 border-red-200 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-50 transition disabled:opacity-50"
                        >
                          <X size={16} />
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

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { motion } from 'framer-motion';
import {
  Phone, Navigation, MapPin, AlertTriangle, X,
  ArrowLeft, ArrowRight, CheckCircle, User, Banknote
} from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import L from 'leaflet';

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="font-size:14px">📍</span></div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

const dropoffIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="font-size:14px">🏁</span></div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
});

// Étapes de la course avec bouton d'action
const STATUS_STEPS = [
  { from: 'driver_assigned', to: 'driver_en_route', label: 'Je suis en route', emoji: '🚀', color: 'bg-blue-500 hover:bg-blue-600' },
  { from: 'driver_en_route', to: 'driver_arrived', label: 'Je suis arrivé', emoji: '📍', color: 'bg-yellow-500 hover:bg-yellow-600' },
  { from: 'driver_arrived', to: 'passenger_onboard', label: 'Passager à bord', emoji: '👤', color: 'bg-brand-500 hover:bg-brand-600' },
  { from: 'passenger_onboard', to: 'completed', label: 'Course terminée', emoji: '🏁', color: 'bg-green-500 hover:bg-green-600' },
];

const STATUS_INFO = {
  driver_assigned: { emoji: '🚀', text: 'Course assignée', sub: 'Dirigez-vous vers le passager' },
  driver_en_route: { emoji: '🏍️', text: 'En route', sub: 'Rendez-vous au point de prise en charge' },
  driver_arrived: { emoji: '📍', text: 'Arrivé', sub: 'En attente du passager' },
  passenger_onboard: { emoji: '🛣️', text: 'En course', sub: 'En route vers la destination' },
  completed: { emoji: '🎉', text: 'Course terminée', sub: 'En attente du paiement' },
};

export default function DriverRidePage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  useEffect(() => {
    loadRide();
    const interval = setInterval(loadRide, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadRide = async () => {
    try {
      const data = await api.get(`/rides/${rideId}`);
      setRide(data);
      // Si payé, retourner à l'accueil
      if (data.status === 'cancelled') {
        navigate('/driver');
      }
      // Si payé, on laisse le chauffeur voir la confirmation puis il revient manuellement
    } catch {
      navigate('/driver');
    }
  };

  const updateStatus = async (newStatus) => {
    setUpdating(true);
    try {
      const data = await api.post(`/rides/${rideId}/status`, { status: newStatus });
      setRide(data);
    } catch (e) {
      alert(e.message);
    }
    setUpdating(false);
  };

  const confirmCashPayment = async () => {
    if (!confirm(`Confirmer la réception de ${ride.agreed_price} F CFA en espèces ?`)) return;
    setConfirmingPayment(true);
    try {
      await api.post('/payments/confirm-cash', { ride_id: rideId });
      loadRide();
    } catch (e) {
      alert(e.message);
    }
    setConfirmingPayment(false);
  };

  const cancelRide = async () => {
    if (!confirm('Annuler la course ? Des frais de 500 F CFA seront déduits de votre crédit.')) return;
    setCancelling(true);
    try {
      await api.post(`/rides/${rideId}/cancel`, { reason: 'Annulé par le chauffeur' });
      navigate('/driver');
    } catch (e) {
      alert(e.message);
      setCancelling(false);
    }
  };

  if (!ride) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusInfo = STATUS_INFO[ride.status] || { emoji: '⏳', text: ride.status, sub: '' };
  const nextStep = STATUS_STEPS.find(s => s.from === ride.status);

  // Déterminer le centre de la carte
  const mapCenter = ride.status === 'passenger_onboard'
    ? [ride.dropoff_lat || 11.8636, ride.dropoff_lng || -15.5977]
    : [ride.pickup_lat || 11.8636, ride.pickup_lng || -15.5977];

  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Carte */}
      <div className="flex-1 relative">
        <button
          onClick={() => navigate('/driver')}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white rounded-2xl shadow-card flex items-center justify-center"
        >
          <ArrowLeft size={18} />
        </button>
        <MapContainer
          center={mapCenter}
          zoom={15}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OSM"
          />
          {ride.pickup_lat && (
            <Marker position={[ride.pickup_lat, ride.pickup_lng]} icon={pickupIcon} />
          )}
          {ride.dropoff_lat && (
            <Marker position={[ride.dropoff_lat, ride.dropoff_lng]} icon={dropoffIcon} />
          )}
        </MapContainer>
      </div>

      {/* Panel inférieur */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-white bottom-sheet px-5 pt-5 pb-8"
      >
        {/* Statut */}
        <motion.div
          key={ride.status}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-2xl"
        >
          <span className="text-2xl">{statusInfo.emoji}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{statusInfo.text}</p>
            <p className="text-xs text-gray-500">{statusInfo.sub}</p>
          </div>
          <p className="text-lg font-extrabold text-brand-600">{ride.agreed_price} F</p>
        </motion.div>

        {/* Info passager et trajet */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-brand-50 rounded-2xl flex items-center justify-center">
            <User size={20} className="text-brand-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">{ride.passenger_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-xs text-gray-400 line-clamp-1">{ride.pickup_address}</p>
              <ArrowRight size={10} className="text-gray-300 flex-shrink-0" />
              <p className="text-xs text-gray-400 line-clamp-1">{ride.dropoff_address}</p>
            </div>
          </div>
          {ride.driver_phone_masked && ride.driver_phone_masked !== '***masqué***' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => window.open(`tel:${ride.passenger_phone || ''}`)}
              className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center"
            >
              <Phone size={18} className="text-green-600" />
            </motion.button>
          )}
        </div>

        {/* Bouton d'action principal */}
        {nextStep ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => updateStatus(nextStep.to)}
            disabled={updating}
            className={`w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 transition-colors ${nextStep.color}`}
          >
            {updating ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="text-xl">{nextStep.emoji}</span>
                {nextStep.label}
              </>
            )}
          </motion.button>
        ) : ride.status === 'completed' ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={confirmCashPayment}
            disabled={confirmingPayment}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 transition-colors"
          >
            {confirmingPayment ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Banknote size={22} />
                Confirmer le paiement — {ride.agreed_price} F
              </>
            )}
          </motion.button>
        ) : ride.status === 'paid' ? (
          <div className="flex items-center justify-center gap-2 py-4 bg-green-50 rounded-2xl">
            <CheckCircle size={22} className="text-green-600" />
            <span className="font-bold text-green-700">Course payée — commission déduite</span>
          </div>
        ) : null}

        {/* Annuler */}
        {ride.status !== 'completed' && ride.status !== 'passenger_onboard' && (
          <button
            onClick={cancelRide}
            disabled={cancelling}
            className="w-full mt-3 py-2.5 text-red-500 text-sm font-medium rounded-xl hover:bg-red-50 transition"
          >
            {cancelling ? 'Annulation...' : 'Annuler la course'}
          </button>
        )}
      </motion.div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { motion } from 'framer-motion';
import {
  Phone, Navigation, MapPin, AlertTriangle, X,
  ArrowLeft, ArrowRight, CheckCircle, User, Banknote, Home, MessageCircle
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
  paid: { emoji: '✅', text: 'Course payée', sub: 'Commission déduite de votre crédit' },
  cancelled: { emoji: '❌', text: 'Course annulée', sub: '' },
};

// Statuts où le bouton Annuler est visible
const CANCELLABLE_STATUSES = ['driver_assigned', 'driver_en_route', 'driver_arrived'];

// Statuts où le bouton Naviguer est visible
const NAVIGABLE_STATUSES = ['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard'];

/**
 * Ouvre l'app de navigation (Waze, Google Maps, ou plan par défaut)
 */
function openNavigation(lat, lng) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  // Essayer Waze d'abord (deep link)
  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  // Google Maps comme fallback
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  // Sur mobile, tenter Waze. Si pas installé, ouvre le navigateur sur waze.com qui redirige
  if (isAndroid || isIOS) {
    window.open(wazeUrl, '_blank');
  } else {
    window.open(gmapsUrl, '_blank');
  }
}

export default function DriverRidePage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);

  // Polling ride + envoi GPS continu
  const geoWatchRef = useRef(null);

  useEffect(() => {
    loadRide();
    const interval = setInterval(loadRide, 3000);

    // Envoyer la position GPS en continu pendant la course
    geoWatchRef.current = navigator.geolocation?.watchPosition(
      (pos) => {
        api.post('/drivers/location', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    return () => {
      clearInterval(interval);
      if (geoWatchRef.current !== null) {
        navigator.geolocation?.clearWatch(geoWatchRef.current);
      }
    };
  }, []);

  const loadRide = async () => {
    try {
      const data = await api.get(`/rides/${rideId}`);
      setRide(data);
      if (data.status === 'cancelled') {
        navigate('/driver');
      }
      if (data.status === 'paid') {
        navigate(`/rate/${rideId}`);
      }
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
      // Redirection immédiate vers la notation puis accueil
      navigate(`/rate/${rideId}`);
    } catch (e) {
      alert(e.message);
      setConfirmingPayment(false);
    }
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

  // Destination pour la navigation (pickup ou dropoff selon le statut)
  const getNavDestination = () => {
    if (!ride) return null;
    if (ride.status === 'passenger_onboard') {
      return ride.dropoff_lat ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng, label: ride.dropoff_address } : null;
    }
    return ride.pickup_lat ? { lat: ride.pickup_lat, lng: ride.pickup_lng, label: ride.pickup_address } : null;
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
  const navDest = getNavDestination();
  const showCancel = CANCELLABLE_STATUSES.includes(ride.status);
  const showNav = NAVIGABLE_STATUSES.includes(ride.status) && navDest;

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

        {/* Bouton Naviguer (Waze/Google Maps) */}
        {showNav && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => openNavigation(navDest.lat, navDest.lng)}
            className="absolute top-4 right-4 z-10 bg-blue-500 text-white rounded-2xl shadow-card flex items-center gap-2 px-4 py-2.5 hover:bg-blue-600 transition"
          >
            <Navigation size={16} />
            <span className="text-sm font-semibold">
              {ride.status === 'passenger_onboard' ? 'Naviguer destination' : 'Naviguer pickup'}
            </span>
          </motion.button>
        )}

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
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-brand-50 rounded-2xl flex items-center justify-center overflow-hidden">
            {ride.passenger_avatar ? (
              <img src={ride.passenger_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-brand-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">{ride.passenger_name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-xs text-gray-400 line-clamp-1">{ride.pickup_address}</p>
              <ArrowRight size={10} className="text-gray-300 flex-shrink-0" />
              <p className="text-xs text-gray-400 line-clamp-1">{ride.dropoff_address}</p>
            </div>
          </div>
        </div>

        {/* Boutons de contact passager */}
        {ride.passenger_phone && (
          <div className="flex gap-2 mb-4">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => window.open(`tel:${ride.passenger_phone}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 rounded-xl hover:bg-green-100 transition"
            >
              <Phone size={16} className="text-green-600" />
              <span className="text-xs font-semibold text-green-700">Appeler</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const phone = ride.passenger_phone.replace('+', '');
                window.open(`https://wa.me/${phone}?text=Bonjour, je suis votre chauffeur MoveBissau. J'arrive bientôt !`);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition"
            >
              <MessageCircle size={16} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">WhatsApp</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => window.open(`sms:${ride.passenger_phone}?body=Bonjour, je suis votre chauffeur MoveBissau.`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
            >
              <MessageCircle size={16} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">SMS</span>
            </motion.button>
          </div>
        )}

        {/* Bouton d'action principal */}
        {nextStep ? (
          <div className="space-y-2">
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

            {/* Bouton navigation sous l'action principale */}
            {showNav && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => openNavigation(navDest.lat, navDest.lng)}
                className="w-full py-3 rounded-2xl bg-blue-50 text-blue-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition"
              >
                <Navigation size={16} />
                Ouvrir dans Waze / Google Maps
              </motion.button>
            )}
          </div>
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
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-4 bg-green-50 rounded-2xl">
              <CheckCircle size={22} className="text-green-600" />
              <span className="font-bold text-green-700">Course payée — commission déduite</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/driver')}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition"
            >
              <Home size={16} />
              Retour à l'accueil
            </motion.button>
          </div>
        ) : null}

        {/* Annuler — uniquement pendant les étapes annulables */}
        {showCancel && (
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

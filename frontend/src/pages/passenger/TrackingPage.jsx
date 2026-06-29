import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import { Phone, Share2, AlertTriangle, ArrowLeft, Home } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import StatusPill from '../../components/ui/StatusPill';
import AnimatedDriverMarker from '../../components/map/AnimatedDriverMarker';
import L from 'leaflet';

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#22c55e;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

const dropoffIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [14, 14], iconAnchor: [7, 7],
});

// Récupérer la route via OSRM (gratuit)
async function fetchRoute(from, to) {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    }
  } catch {}
  return null;
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length >= 2) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [bounds]);
  return null;
}

export default function TrackingPage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [ride, setRide] = useState(null);
  const [driverPos, setDriverPos] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [showSos, setShowSos] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [sosLoading, setSosLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    loadRide();
    const interval = setInterval(loadRide, 3000); // 3s pour un suivi plus fluide
    return () => clearInterval(interval);
  }, []);

  const loadRide = async () => {
    try {
      const data = await api.get(`/rides/${rideId}`);
      setRide(data);
      // Mettre à jour la position du chauffeur si disponible
      if (data.driver_lat && data.driver_lng) {
        setDriverPos([data.driver_lat, data.driver_lng]);
      }
      // Rediriger vers la notation dès que la course est payée
      if (data.status === 'paid') {
        navigate(`/rate/${rideId}`, { replace: true });
      }
      // Si annulée, retour accueil
      if (data.status === 'cancelled') {
        navigate('/', { replace: true });
      }
    } catch {}
  };

  // Charger la route quand on a les coordonnées
  useEffect(() => {
    if (!ride) return;
    const pickupCoords = ride.pickup_lat ? [ride.pickup_lat, ride.pickup_lng] : null;
    const dropoffCoords = ride.dropoff_lat ? [ride.dropoff_lat, ride.dropoff_lng] : null;
    if (pickupCoords && dropoffCoords) {
      fetchRoute(pickupCoords, dropoffCoords).then(coords => {
        if (coords) setRouteCoords(coords);
      });
    }
  }, [ride?.id]);

  const triggerSos = async () => {
    setSosLoading(true);
    try {
      await api.post(`/rides/${rideId}/sos`);
      toast.show('SOS envoyé ! Restez en sécurité.', 'success', 5000);
      setShowSos(false);
    } catch (e) {
      toast.show(e.message || 'Erreur SOS', 'error');
    }
    setSosLoading(false);
  };

  const shareTrip = async () => {
    try {
      const data = await api.post(`/rides/${rideId}/share`);
      if (navigator.share) {
        navigator.share({ title: 'Mon trajet MoveBissau', url: data.share_url });
      } else {
        navigator.clipboard.writeText(data.share_url);
        toast.show('Lien copié !', 'success');
      }
    } catch {}
  };

  const cancelRide = async () => {
    setCancelLoading(true);
    try {
      await api.post(`/rides/${rideId}/cancel`, { reason: 'Annulé par le passager' });
      navigate('/');
    } catch (e) {
      toast.show(e.message || 'Erreur', 'error');
      setCancelLoading(false);
      setShowCancel(false);
    }
  };

  if (!ride) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-white gap-3">
        <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Chargement de la course...</p>
      </div>
    );
  }

  // Calcul ETA (vitesse moyenne 20 km/h en ville)
  const calcEta = () => {
    if (!driverPos) return null;
    const target = ['driver_assigned', 'driver_en_route'].includes(ride.status)
      ? (ride.pickup_lat ? [ride.pickup_lat, ride.pickup_lng] : null)
      : ['passenger_onboard'].includes(ride.status)
        ? (ride.dropoff_lat ? [ride.dropoff_lat, ride.dropoff_lng] : null)
        : null;
    if (!target) return null;
    // Haversine simplifié
    const R = 6371000;
    const dLat = (target[0] - driverPos[0]) * Math.PI / 180;
    const dLng = (target[1] - driverPos[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(driverPos[0]*Math.PI/180) * Math.cos(target[0]*Math.PI/180) * Math.sin(dLng/2)**2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const minutes = Math.max(1, Math.round(dist / (20000/60))); // 20km/h
    return minutes;
  };

  const etaMin = calcEta();
  const etaText = etaMin ? (etaMin <= 1 ? '~1 min' : `~${etaMin} min`) : null;

  const statusMessages = {
    driver_assigned: { emoji: '🚀', text: 'Chauffeur assigné', sub: etaText ? `Arrivée estimée : ${etaText}` : 'Il va bientôt partir' },
    driver_en_route: { emoji: '🏍️', text: 'En route vers vous', sub: etaText ? `Arrive dans ${etaText}` : 'Il arrive bientôt !' },
    driver_arrived:  { emoji: '📍', text: 'Il est arrivé !', sub: 'Rejoignez votre chauffeur' },
    passenger_onboard: { emoji: '🛣️', text: 'En course', sub: etaText ? `Arrivée dans ${etaText}` : 'Profitez du trajet' },
    completed:       { emoji: '🎉', text: 'Vous êtes arrivé !', sub: 'Procédez au paiement' },
    paid:            { emoji: '✅', text: 'Course payée', sub: 'Notez votre chauffeur' },
  };
  const statusInfo = statusMessages[ride.status] || { emoji: '⏳', text: ride.status, sub: '' };

  const pickupCoords = ride.pickup_lat ? [ride.pickup_lat, ride.pickup_lng] : null;
  const dropoffCoords = ride.dropoff_lat ? [ride.dropoff_lat, ride.dropoff_lng] : null;
  const mapCenter = pickupCoords || [11.8636, -15.5977];
  const bounds = [pickupCoords, dropoffCoords, driverPos].filter(Boolean);

  return (
    <div className="h-[100dvh] flex flex-col bg-white relative">
      {/* Carte */}
      <div className="flex-1 relative">
        <MapContainer center={mapCenter} zoom={15} zoomControl={false} className="h-full w-full">
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OSM'
          />
          {pickupCoords && <Marker position={pickupCoords} icon={pickupIcon} />}
          {dropoffCoords && <Marker position={dropoffCoords} icon={dropoffIcon} />}
          {driverPos && (
            <AnimatedDriverMarker
              position={driverPos}
              vehicleType={ride.vehicle_type}
              followCamera={['driver_en_route', 'passenger_onboard'].includes(ride.status)}
            />
          )}
          {routeCoords && (
            <Polyline positions={routeCoords} pathOptions={{ color: '#1B8A4E', weight: 4, opacity: 0.7, dashArray: '8 6' }} />
          )}
          {bounds.length >= 2 && <FitBounds bounds={bounds} />}
        </MapContainer>

        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 z-10 bg-white rounded-2xl shadow-card flex items-center gap-2 px-3 py-2.5"
        >
          <ArrowLeft size={16} className="text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Accueil</span>
        </button>
      </div>

      {/* Panel inférieur */}
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-white bottom-sheet px-5 pt-5 pb-8">
        {/* Statut animé */}
        <motion.div
          key={ride.status}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 mb-5 p-4 bg-gray-50 rounded-2xl"
        >
          <span className="text-3xl">{statusInfo.emoji}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-800">{statusInfo.text}</p>
            <p className="text-sm text-gray-500">{statusInfo.sub}</p>
          </div>
          <StatusPill status={ride.status} />
        </motion.div>

        {/* Info chauffeur */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-xl">
            {ride.vehicle_type === 'moto' ? '🏍️' : '🚗'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{ride.driver_name}</p>
            {ride.driver_vehicle && (
              <p className="text-xs text-gray-500">
                {ride.driver_vehicle.brand} {ride.driver_vehicle.model} · {ride.driver_vehicle.color}
                {ride.driver_vehicle.plate && ` · ${ride.driver_vehicle.plate}`}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-brand-600">{ride.agreed_price} F</p>
          </div>
        </div>

        {/* Actions selon statut */}
        {ride.status === 'completed' ? (
          <div className="space-y-2">
            <Button onClick={() => navigate(`/payment/${rideId}`)}>
              Payer {ride.agreed_price} F CFA
            </Button>
            <p className="text-xs text-gray-400 text-center">Le chauffeur attend votre paiement</p>
          </div>
        ) : ride.status === 'paid' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-2xl">
              <span className="text-green-600 font-bold text-sm">✅ Course payée</span>
            </div>
            <Button onClick={() => navigate(`/rate/${rideId}`)}>
              Noter le chauffeur
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => ride.driver_phone_masked !== '***masqué***' && window.open(`tel:${ride.driver_phone_masked}`)}
              className="flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition"
            >
              <Phone size={20} className="text-brand-500" />
              <span className="text-xs text-gray-600">Appeler</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={shareTrip}
              className="flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition"
            >
              <Share2 size={20} className="text-blue-500" />
              <span className="text-xs text-gray-600">Partager</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSos(true)}
              className="flex flex-col items-center gap-1 py-3 bg-red-50 rounded-2xl hover:bg-red-100 transition"
            >
              <AlertTriangle size={20} className="text-red-500" />
              <span className="text-xs text-red-600 font-semibold">SOS</span>
            </motion.button>
          </div>
        )}

        {['driver_assigned', 'driver_en_route', 'driver_arrived'].includes(ride.status) && (
          <button
            onClick={() => setShowCancel(true)}
            className="w-full mt-3 py-2.5 text-red-500 text-sm font-medium rounded-xl hover:bg-red-50 transition"
          >
            Annuler la course
          </button>
        )}
      </motion.div>

      {/* Modales */}
      <ConfirmModal
        open={showSos}
        title="Appel d'urgence"
        message="Les services de sécurité seront alertés et pourront voir votre position en temps réel."
        confirmLabel="Envoyer SOS"
        variant="danger"
        loading={sosLoading}
        onConfirm={triggerSos}
        onCancel={() => setShowSos(false)}
      />
      <ConfirmModal
        open={showCancel}
        title="Annuler la course ?"
        message="Des frais de 500 F CFA peuvent s'appliquer si le chauffeur est déjà en route."
        confirmLabel="Annuler la course"
        variant="warning"
        loading={cancelLoading}
        onConfirm={cancelRide}
        onCancel={() => setShowCancel(false)}
      />
    </div>
  );
}

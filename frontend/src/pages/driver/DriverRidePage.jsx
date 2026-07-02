import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Navigation, MapPin, AlertTriangle, X,
  ArrowLeft, ArrowRight, CheckCircle, User, Banknote, Home, MessageCircle
} from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import ConfirmModal from '../../components/ui/ConfirmModal';
import RideChat from '../../components/ui/RideChat';
import { useToast } from '../../components/ui/Toast';
import L from 'leaflet';
import { useTranslation } from '../../i18n/useTranslation';
import { useCountryConfig } from '../../hooks/useCountryConfig';

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

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

/**
 * Ouvre l'app de navigation (Waze, Google Maps, ou plan par défaut)
 */
function openNavigation(lat, lng) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  if (isAndroid || isIOS) {
    window.open(wazeUrl, '_blank');
  } else {
    window.open(gmapsUrl, '_blank');
  }
}

// Statuts où le bouton Annuler est visible
const CANCELLABLE_STATUSES = ['driver_assigned', 'driver_en_route', 'driver_arrived'];

// Statuts où le bouton Naviguer est visible
const NAVIGABLE_STATUSES = ['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard'];

export default function DriverRidePage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const country = useCountryConfig();
  const [ride, setRide] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSos, setShowSos] = useState(false);
  const toast = useToast();

  // Type réel du véhicule du chauffeur
  const myVehicleType = ride?.driver_vehicle?.type || ride?.vehicle_type;
  const myVehicleEmoji = myVehicleType === 'car' ? '🚗' : '🏍️';

  // Étapes de la course avec bouton d'action
  const STATUS_STEPS = [
    { from: 'driver_assigned', to: 'driver_en_route', label: t('driver.btnEnRoute'), emoji: '🚀', color: 'bg-blue-500 hover:bg-blue-600' },
    { from: 'driver_en_route', to: 'driver_arrived', label: t('driver.btnArrived'), emoji: '📍', color: 'bg-yellow-500 hover:bg-yellow-600' },
    { from: 'driver_arrived', to: 'passenger_onboard', label: t('driver.btnOnboard'), emoji: '👤', color: 'bg-brand-500 hover:bg-brand-600' },
    { from: 'passenger_onboard', to: 'completed', label: t('driver.btnCompleted'), emoji: '🏁', color: 'bg-green-500 hover:bg-green-600' },
  ];

  const STATUS_INFO = {
    driver_assigned: { emoji: '🚀', text: t('driver.rideAssigned'), sub: t('driver.rideAssignedSub') },
    driver_en_route: { emoji: myVehicleEmoji, text: t('driver.enRoute'), sub: t('driver.enRouteSub') },
    driver_arrived: { emoji: '📍', text: t('driver.arrivedStatus'), sub: t('driver.arrivedSub') },
    passenger_onboard: { emoji: myVehicleEmoji, text: t('driver.onboard'), sub: t('driver.onboardSub') },
    completed: { emoji: '🎉', text: t('driver.rideCompleted'), sub: t('driver.waitingPayment') },
    paid: { emoji: '✅', text: t('driver.ridePaid'), sub: t('driver.ridePaidSub') },
    cancelled: { emoji: '❌', text: t('driver.cancelRide'), sub: '' },
  };

  // Polling ride + envoi GPS continu
  const geoWatchRef = useRef(null);

  useEffect(() => {
    loadRide();
    const interval = setInterval(loadRide, 3000);

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
    setConfirmingPayment(true);
    try {
      await api.post('/payments/confirm-cash', { ride_id: rideId });
      navigate(`/rate/${rideId}`);
    } catch (e) {
      toast.show(e.message || t('common.error'), 'error');
      setConfirmingPayment(false);
      setShowPaymentModal(false);
    }
  };

  const cancelRide = async () => {
    setCancelling(true);
    try {
      await api.post(`/rides/${rideId}/cancel`, { reason: t('driver.cancelRide') });
      navigate('/driver');
    } catch (e) {
      toast.show(e.message || t('common.error'), 'error');
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

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

  const mapCenter = ride.status === 'passenger_onboard'
    ? [ride.dropoff_lat || 11.8636, ride.dropoff_lng || -15.5977]
    : [ride.pickup_lat || 11.8636, ride.pickup_lng || -15.5977];

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-50 overflow-hidden">
      {/* Carte — réduite quand la course est terminée/payée */}
      <div className={`${['completed', 'paid'].includes(ride?.status) ? 'h-[25vh]' : 'h-[40vh]'} relative flex-shrink-0 transition-all duration-500`}>
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
              {ride.status === 'passenger_onboard' ? t('driver.navigateDestination') : t('driver.navigatePickup')}
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
          <InvalidateSize />
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
        className="bg-white flex-1 overflow-y-auto px-5 pt-4 pb-6 rounded-t-[1.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.1)] -mt-4 relative z-10"
      >
        {/* Poignée */}
        <div className="flex justify-center mb-3">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Statut + prix */}
        <motion.div
          key={ride.status}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 mb-3 p-3 bg-brand-50 rounded-2xl"
        >
          <span className="text-2xl">{statusInfo.emoji}</span>
          <div className="flex-1">
            <p className="font-bold text-gray-800 text-sm">{statusInfo.text}</p>
            <p className="text-[11px] text-gray-500">{statusInfo.sub}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-brand-600">{ride.agreed_price}</p>
            <p className="text-[10px] text-gray-400">F CFA</p>
          </div>
        </motion.div>

        {/* Passager + trajet compact */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
            {ride.passenger_avatar ? (
              <img src={ride.passenger_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={18} className="text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">{ride.passenger_name}</p>
            <p className="text-[11px] text-gray-400 truncate">{ride.pickup_address} → {ride.dropoff_address}</p>
          </div>
        </div>

        {/* Boutons de contact passager */}
        {ride.passenger_phone && (
          <div className="flex gap-2 mb-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => window.open(`tel:${ride.passenger_phone}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 rounded-xl hover:bg-green-100 transition"
            >
              <Phone size={16} className="text-green-600" />
              <span className="text-xs font-semibold text-green-700">{t('driver.callPassenger')}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const phone = ride.passenger_phone.replace('+', '');
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(t('driver.whatsappMsg'))}`);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition"
            >
              <MessageCircle size={16} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">{t('driver.whatsapp')}</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => window.open(`sms:${ride.passenger_phone}?body=${encodeURIComponent(t('driver.smsMsg'))}`)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
            >
              <MessageCircle size={16} className="text-blue-600" />
              <span className="text-xs font-semibold text-blue-700">{t('driver.sms')}</span>
            </motion.button>
          </div>
        )}

        {/* Chat in-app avec le passager */}
        {ride.status !== 'paid' && (
          <div className="mb-3">
            <RideChat rideId={rideId} role="driver" />
          </div>
        )}

        {/* SOS chauffeur */}
        {['driver_assigned', 'driver_en_route', 'driver_arrived', 'passenger_onboard'].includes(ride.status) && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSos(true)}
            className="w-full mb-3 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-100 transition"
          >
            <AlertTriangle size={16} />
            SOS
          </motion.button>
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
                {t('driver.openNavigation')}
              </motion.button>
            )}
          </div>
        ) : ride.status === 'completed' ? (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowPaymentModal(true)}
            disabled={confirmingPayment}
            className="w-full py-4 rounded-2xl text-white font-bold text-base flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 transition-colors"
          >
            {confirmingPayment ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Banknote size={22} />
                {t('driver.confirmPayment')} — {ride.amount_due ?? ride.agreed_price} F
              </>
            )}
          </motion.button>
        ) : ride.status === 'paid' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-4 bg-green-50 rounded-2xl">
              <CheckCircle size={22} className="text-green-600" />
              <span className="font-bold text-green-700">{t('driver.paidCommission')}</span>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/driver')}
              className="w-full py-3 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition"
            >
              <Home size={16} />
              {t('driver.backHome')}
            </motion.button>
          </div>
        ) : null}

        {/* Annuler */}
        {showCancel && (
          <button
            onClick={() => setShowCancelModal(true)}
            disabled={cancelling}
            className="w-full mt-3 py-2.5 text-red-500 text-sm font-medium rounded-xl hover:bg-red-50 transition"
          >
            {cancelling ? '...' : t('driver.cancelRide')}
          </button>
        )}
      </motion.div>

      {/* Modal SOS */}
      <AnimatePresence>
        {showSos && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center px-5">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSos(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
              className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-center text-gray-800 mb-2">{t('tracking.sosTitle')}</h3>
              <p className="text-sm text-gray-500 text-center mb-4">{t('tracking.sosMessage')}</p>

              {country.sos_numbers && (
                <div className="space-y-2 mb-5">
                  {[
                    { key: 'police', icon: '🚔', label: t('sos.police') },
                    { key: 'pompiers', icon: '🚒', label: t('sos.pompiers') },
                    { key: 'gendarmerie', icon: '🛡️', label: t('sos.gendarmerie') },
                    { key: 'samu', icon: '🚑', label: t('sos.samu') },
                  ].filter(s => country.sos_numbers[s.key]).map(s => (
                    <a
                      key={s.key}
                      href={`tel:${country.sos_numbers[s.key]}`}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                    >
                      <span className="text-lg">{s.icon}</span>
                      <span className="flex-1 font-semibold text-sm text-gray-800">{s.label}</span>
                      <span className="text-sm font-mono text-brand-600">{country.sos_numbers[s.key]}</span>
                    </a>
                  ))}
                </div>
              )}

              <button onClick={() => setShowSos(false)}
                className="w-full py-3.5 rounded-2xl border-2 border-gray-200 font-semibold text-gray-600 hover:bg-gray-50">
                {t('common.cancel')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal confirmation paiement */}
      <ConfirmModal
        open={showPaymentModal}
        title={t('driver.confirmPaymentTitle')}
        message={`${t('driver.confirmPaymentMsg')} ${ride?.amount_due ?? ride?.agreed_price} F CFA ${t('driver.confirmPaymentMsgEnd')}${
          ride?.discount_amount > 0
            ? ` (${t('driver.promoCompensation', 'Promo appliquée : la réduction de')} ${ride.discount_amount} F ${t('driver.promoCompensationEnd', 'vous est recréditée sur votre crédit commission.')})`
            : ''
        }`}
        confirmLabel={confirmingPayment ? '...' : `${t('driver.yesReceived')} ${ride?.amount_due ?? ride?.agreed_price} F`}
        variant="success"
        loading={confirmingPayment}
        onConfirm={confirmCashPayment}
        onCancel={() => setShowPaymentModal(false)}
      />

      {/* Modal annulation */}
      <ConfirmModal
        open={showCancelModal}
        title={t('driver.cancelRideTitle')}
        message={t('driver.cancelRideMsg')}
        confirmLabel={cancelling ? '...' : t('driver.cancelRideConfirm')}
        cancelLabel={t('driver.cancelRideKeep')}
        variant="danger"
        loading={cancelling}
        onConfirm={cancelRide}
        onCancel={() => setShowCancelModal(false)}
      />
    </div>
  );
}

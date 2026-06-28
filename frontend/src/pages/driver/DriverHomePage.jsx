import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power, Wallet, Star, Car, Clock, AlertCircle,
  ChevronRight, Timer, TrendingUp, MapPin, Navigation,
  Send, X, CheckCircle
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useDriverStats } from '../../hooks/useDriverStats';
import Button from '../../components/ui/Button';
import DriverNav from '../../components/layout/DriverNav';
import DailyProgress from '../../components/driver/DailyProgress';
import NotifBell from '../../components/driver/NotifBell';

export default function DriverHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(false);
  const [profile, setProfile] = useState(null);
  const [credit, setCredit] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  // Demandes de course
  const [rideRequests, setRideRequests] = useState([]);
  const [counterPrices, setCounterPrices] = useState({});
  const [showCounter, setShowCounter] = useState({});
  const [sendingOffer, setSendingOffer] = useState(null);
  const [sentOffers, setSentOffers] = useState(new Set());

  // WebSocket refs
  const requestsWsRef = useRef(null);
  const locationWsRef = useRef(null);
  const geoWatchRef = useRef(null);

  const stats = useDriverStats(isOnline);

  useEffect(() => { loadProfile(); loadCredit(); }, []);

  // Nettoyage WebSocket au démontage
  useEffect(() => {
    return () => {
      closeWebSockets();
    };
  }, []);

  // Gestion WebSocket selon état en ligne
  // Polling REST des demandes (fallback quand WebSocket non dispo)
  const pollRef = useRef(null);

  useEffect(() => {
    if (isOnline) {
      connectRequestsWs();
      connectLocationWs();
      // Polling REST toutes les 5s en parallèle (fallback)
      pollNearbyRequests();
      pollRef.current = setInterval(pollNearbyRequests, 5000);
    } else {
      closeWebSockets();
      clearInterval(pollRef.current);
      setRideRequests([]);
      setSentOffers(new Set());
    }
    return () => clearInterval(pollRef.current);
  }, [isOnline]);

  const pollNearbyRequests = async () => {
    try {
      const data = await api.get('/rides/requests/nearby');
      if (Array.isArray(data) && data.length > 0) {
        setRideRequests(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRequests = data.filter(r => !existingIds.has(r.id) && !sentOffers.has(r.id));
          if (newRequests.length === 0) return prev;
          return [...newRequests, ...prev];
        });
      }
    } catch {}
  };

  // Countdown pour expiration des demandes
  useEffect(() => {
    if (rideRequests.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setRideRequests(prev => prev.filter(r => new Date(r.expires_at).getTime() > now));
    }, 1000);
    return () => clearInterval(interval);
  }, [rideRequests.length]);

  const loadProfile = async () => {
    try {
      const data = await api.get('/drivers/me');
      setProfile(data);
      setIsOnline(data.is_online);
    } catch {}
  };

  const loadCredit = async () => {
    try { setCredit(await api.get('/commissions/balance')); } catch {}
  };

  // Envoi GPS via REST (fallback quand WebSocket non dispo)
  const geoRestRef = useRef(null);

  useEffect(() => {
    if (isOnline) {
      startGeoRestPolling();
    } else {
      stopGeoRestPolling();
    }
    return () => stopGeoRestPolling();
  }, [isOnline]);

  const startGeoRestPolling = () => {
    if (geoRestRef.current) return;
    geoRestRef.current = navigator.geolocation?.watchPosition(
      (pos) => {
        api.post('/drivers/location', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  const stopGeoRestPolling = () => {
    if (geoRestRef.current !== null) {
      navigator.geolocation?.clearWatch(geoRestRef.current);
      geoRestRef.current = null;
    }
  };

  const toggleOnline = async () => {
    setToggling(true); setError('');
    try {
      await api.post(isOnline ? '/drivers/go-offline' : '/drivers/go-online');
      setIsOnline(!isOnline);
    } catch (e) { setError(e.message); }
    setToggling(false);
  };

  // === WebSocket : Demandes de course ===
  const connectRequestsWs = useCallback(() => {
    if (requestsWsRef.current) return;
    const token = localStorage.getItem('mb_access');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/driver/requests/?token=${token}`);

    ws.onopen = () => console.log('[WS] Requests connected');

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'new_ride_request' && data.ride_request) {
          setRideRequests(prev => {
            if (prev.some(r => r.id === data.ride_request.id)) return prev;
            return [data.ride_request, ...prev];
          });
        }
        // Quand une offre est acceptée, rediriger vers la course
        if (data.type === 'ride_status_changed' && data.ride) {
          navigate(`/driver/ride/${data.ride.id}`);
        }
      } catch {}
    };

    ws.onclose = () => {
      requestsWsRef.current = null;
      // Reconnexion auto après 3s si toujours en ligne
      setTimeout(() => {
        if (isOnline && !requestsWsRef.current) connectRequestsWs();
      }, 3000);
    };

    requestsWsRef.current = ws;
  }, [isOnline, navigate]);

  // === WebSocket : Envoi GPS ===
  const connectLocationWs = useCallback(() => {
    if (locationWsRef.current) return;
    const token = localStorage.getItem('mb_access');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/driver/location/?token=${token}`);

    ws.onopen = () => {
      console.log('[WS] Location connected');
      // Démarrer le tracking GPS
      if (navigator.geolocation) {
        geoWatchRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                heading: pos.coords.heading || 0,
                speed: pos.coords.speed || 0,
              }));
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
        );
      }
    };

    ws.onclose = () => {
      locationWsRef.current = null;
      if (geoWatchRef.current !== null) {
        navigator.geolocation.clearWatch(geoWatchRef.current);
        geoWatchRef.current = null;
      }
      setTimeout(() => {
        if (isOnline && !locationWsRef.current) connectLocationWs();
      }, 3000);
    };

    locationWsRef.current = ws;
  }, [isOnline]);

  const closeWebSockets = () => {
    if (requestsWsRef.current) {
      requestsWsRef.current.onclose = null; // Éviter la reconnexion auto
      requestsWsRef.current.close();
      requestsWsRef.current = null;
    }
    if (locationWsRef.current) {
      locationWsRef.current.onclose = null;
      locationWsRef.current.close();
      locationWsRef.current = null;
    }
    if (geoWatchRef.current !== null) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
  };

  // === Envoyer une offre ===
  const sendOffer = async (requestId, price) => {
    setSendingOffer(requestId);
    try {
      await api.post('/rides/offers', {
        ride_request_id: requestId,
        offered_price: price,
      });
      setSentOffers(prev => new Set([...prev, requestId]));
      setShowCounter(prev => ({ ...prev, [requestId]: false }));
    } catch (e) {
      alert(e.message);
    }
    setSendingOffer(null);
  };

  // Helper : temps restant
  const getTimeLeft = (expiresAt) => {
    const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    const min = Math.floor(diff / 60);
    const sec = diff % 60;
    return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* === Header === */}
      <div className={`transition-colors duration-500 ${isOnline ? 'bg-brand-600' : 'bg-gray-900'}`}>
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/60 text-xs font-medium">Bonjour</p>
              <h1 className="text-white text-xl font-bold">{user?.first_name} 👋</h1>
            </div>
            <div className="flex items-center gap-2">
              <NotifBell />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/driver/credit')}
                className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-white/10"
              >
                <Wallet size={16} className="text-gold" />
                <div className="text-left">
                  <p className="text-white text-sm font-bold">{credit?.balance || 0} F</p>
                  <p className="text-white/50 text-[9px]">Crédit</p>
                </div>
              </motion.button>
            </div>
          </div>

          {isOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center justify-center gap-2 mb-3 bg-white/10 rounded-xl py-2"
            >
              <Timer size={14} className="text-green-300" />
              <span className="text-white/80 text-xs">En ligne depuis</span>
              <span className="text-white font-mono font-bold text-sm">{stats.onlineTimer}</span>
            </motion.div>
          )}

          {/* Bouton ON/OFF */}
          <div className="flex flex-col items-center py-3">
            <motion.button whileTap={{ scale: 0.92 }} onClick={toggleOnline} disabled={toggling} className="relative">
              {isOnline && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-green-400/30"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <div className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all duration-500 ${
                isOnline ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-[0_0_40px_rgba(74,222,128,0.4)]' : 'bg-gray-700 shadow-xl'
              }`}>
                {toggling ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Power size={26} className="text-white" />
                    <span className="text-white text-[9px] font-bold mt-1 tracking-wider">
                      {isOnline ? 'EN LIGNE' : 'HORS LIGNE'}
                    </span>
                  </>
                )}
              </div>
            </motion.button>
            <p className="text-white/50 text-xs mt-3">
              {isOnline ? 'Vous recevez des demandes' : 'Appuyez pour recevoir des courses'}
            </p>
          </div>
        </div>

        {/* Gains du jour */}
        <div className="px-5 pb-5">
          <div className="grid grid-cols-3 gap-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"
            >
              <TrendingUp size={16} className="mx-auto text-green-400" />
              <motion.p key={stats.todayEarnings} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                className="text-white font-bold text-lg mt-1"
              >
                {stats.todayEarnings.toLocaleString()} F
              </motion.p>
              <p className="text-white/40 text-[10px]">Gains du jour</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"
            >
              <Car size={16} className="mx-auto text-blue-400" />
              <p className="text-white font-bold text-lg mt-1">{stats.todayCount}</p>
              <p className="text-white/40 text-[10px]">Courses</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"
            >
              <Star size={16} className="mx-auto text-yellow-400" />
              <p className="text-white font-bold text-lg mt-1">
                {profile ? Number(profile.average_rating).toFixed(1) : '—'}
              </p>
              <p className="text-white/40 text-[10px]">Note</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* === Contenu === */}
      <div className="px-5 -mt-3 space-y-4">

        <DailyProgress
          todayEarnings={stats.todayEarnings}
          dailyGoal={stats.dailyGoal}
          goalProgress={stats.goalProgress}
          goalReached={stats.goalReached}
          onGoalChange={stats.setDailyGoal}
          onDismissGoalReached={() => stats.setGoalReached(false)}
        />

        {/* Alerte crédit bas */}
        {credit && !credit.has_sufficient_credit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertCircle size={20} className="text-yellow-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-800">Crédit insuffisant</p>
              <p className="text-xs text-yellow-600">Rechargez pour recevoir des courses</p>
            </div>
            <Button size="sm" variant="gold" onClick={() => navigate('/driver/credit')}>Recharger</Button>
          </motion.div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-center">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* === Demandes de course === */}
        {isOnline && (
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">
              Demandes en cours
              {rideRequests.length > 0 && (
                <span className="ml-2 bg-brand-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {rideRequests.length}
                </span>
              )}
            </h3>

            {rideRequests.length === 0 ? (
              /* Spinner quand aucune demande */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white rounded-2xl p-10 shadow-soft text-center"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 border-2 border-brand-200 border-t-brand-500 rounded-full mx-auto"
                />
                <p className="text-gray-700 font-medium mt-5">En recherche de courses...</p>
                <p className="text-gray-400 text-sm mt-1">Les demandes proches apparaîtront ici</p>
              </motion.div>
            ) : (
              /* Liste des demandes */
              <AnimatePresence>
                <div className="space-y-3">
                  {rideRequests.map((req) => {
                    const alreadySent = sentOffers.has(req.id);
                    const isSending = sendingOffer === req.id;
                    const isCounterOpen = showCounter[req.id];

                    return (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -100 }}
                        className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden"
                      >
                        {/* En-tête avec countdown */}
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{req.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                            <span className="text-sm font-medium text-gray-700">{req.passenger_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-red-50 px-2.5 py-1 rounded-full">
                            <Clock size={12} className="text-red-500" />
                            <span className="text-xs font-mono font-bold text-red-600">{getTimeLeft(req.expires_at)}</span>
                          </div>
                        </div>

                        {/* Adresses */}
                        <div className="px-4 py-2 space-y-2">
                          <div className="flex items-start gap-2.5">
                            <div className="mt-1 w-3 h-3 rounded-full bg-green-500 border-2 border-green-200 flex-shrink-0" />
                            <p className="text-sm text-gray-800 line-clamp-1">{req.pickup_address}</p>
                          </div>
                          <div className="flex items-start gap-2.5">
                            <div className="mt-1 w-3 h-3 rounded-full bg-red-500 border-2 border-red-200 flex-shrink-0" />
                            <p className="text-sm text-gray-800 line-clamp-1">{req.dropoff_address}</p>
                          </div>
                        </div>

                        {/* Prix et distance */}
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50/50">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Navigation size={12} />
                              {((req.estimated_distance_m || 0) / 1000).toFixed(1)} km
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-extrabold text-brand-600">{req.proposed_price} F</p>
                            {req.suggested_price !== req.proposed_price && (
                              <p className="text-[10px] text-gray-400">Suggéré : {req.suggested_price} F</p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="px-4 py-3 border-t border-gray-100">
                          {alreadySent ? (
                            <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                              <CheckCircle size={18} />
                              <span className="text-sm font-semibold">Offre envoyée — en attente</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex gap-2">
                                <Button
                                  size="full"
                                  loading={isSending && !isCounterOpen}
                                  onClick={() => sendOffer(req.id, req.proposed_price)}
                                  className="flex-1"
                                >
                                  <Send size={14} />
                                  Accepter — {req.proposed_price} F
                                </Button>
                                <motion.button
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setShowCounter(p => ({ ...p, [req.id]: !p[req.id] }))}
                                  className={`px-3 rounded-xl border-2 transition-colors ${
                                    isCounterOpen
                                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                                  }`}
                                >
                                  <TrendingUp size={16} />
                                </motion.button>
                              </div>

                              {/* Contre-offre */}
                              <AnimatePresence>
                                {isCounterOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex items-center gap-2 mt-3">
                                      <input
                                        type="number"
                                        placeholder="Votre prix"
                                        value={counterPrices[req.id] || ''}
                                        onChange={e => setCounterPrices(p => ({ ...p, [req.id]: e.target.value }))}
                                        className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-center font-bold text-lg focus:border-brand-500 focus:outline-none"
                                      />
                                      <span className="text-sm text-gray-500 font-medium">F CFA</span>
                                      <Button
                                        size="sm"
                                        loading={isSending && isCounterOpen}
                                        onClick={() => {
                                          const price = parseInt(counterPrices[req.id]);
                                          if (!price || price < 100) return alert('Prix invalide');
                                          sendOffer(req.id, price);
                                        }}
                                      >
                                        Envoyer
                                      </Button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            )}
          </div>
        )}

        {/* Raccourcis quand hors ligne */}
        {!isOnline && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="space-y-3 pt-1"
          >
            <h3 className="font-semibold text-gray-800">Raccourcis</h3>
            {[
              { icon: Wallet, label: 'Recharger mon crédit', desc: `Solde : ${credit?.balance || 0} F CFA`, to: '/driver/credit', color: 'bg-blue-50 text-blue-600' },
              { icon: Clock, label: 'Voir mon historique', desc: `${stats.weeklyRides} courses cette semaine`, to: '/driver/history', color: 'bg-purple-50 text-purple-600' },
              { icon: Star, label: 'Mon profil', desc: `Note : ${profile ? Number(profile.average_rating).toFixed(1) : '—'}/5`, to: '/driver/profile', color: 'bg-yellow-50 text-yellow-600' },
            ].map((item, i) => (
              <motion.button key={item.to} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                onClick={() => navigate(item.to)}
                className="w-full bg-white rounded-2xl p-4 shadow-soft flex items-center gap-4 hover:shadow-card transition-shadow text-left"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>

      <DriverNav />
    </div>
  );
}

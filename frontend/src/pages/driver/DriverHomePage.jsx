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
import { useNotifications } from '../../hooks/useNotifications';
import { useDriverStats } from '../../hooks/useDriverStats';
import Button from '../../components/ui/Button';
import DriverNav from '../../components/layout/DriverNav';
import DailyProgress from '../../components/driver/DailyProgress';
import NotifBell from '../../components/driver/NotifBell';
import { useTranslation } from '../../i18n/useTranslation';

export default function DriverHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
  const seenRequestsRef = useRef(new Set());

  // WebSocket refs
  const requestsWsRef = useRef(null);
  const locationWsRef = useRef(null);
  const geoWatchRef = useRef(null);

  const stats = useDriverStats(isOnline);
  const { notify, requestPermission, stopSound } = useNotifications();

  useEffect(() => {
    loadProfile();
    loadCredit();
    checkActiveRide();
  }, []);

  const activeRideRef = useRef(null);
  useEffect(() => {
    activeRideRef.current = setInterval(checkActiveRide, 3000);
    return () => clearInterval(activeRideRef.current);
  }, []);

  const checkActiveRide = async () => {
    try {
      const data = await api.get('/rides/history?status=active');
      if (data?.results?.length > 0) {
        const ride = data.results[0];
        console.log('[Driver] Active ride detected:', ride.id, ride.status);
        navigate(`/driver/ride/${ride.id}`);
      }
    } catch (e) {
      console.log('[Driver] checkActiveRide error:', e.message);
    }
  };

  useEffect(() => {
    return () => {
      closeWebSockets();
    };
  }, []);

  const pollRef = useRef(null);

  useEffect(() => {
    if (isOnline) {
      connectRequestsWs();
      connectLocationWs();
      pollNearbyRequests();
      pollRef.current = setInterval(pollNearbyRequests, 5000);
    } else {
      closeWebSockets();
      clearInterval(pollRef.current);
      setRideRequests([]);
      setSentOffers(new Set());
      seenRequestsRef.current.clear();
    }
    return () => clearInterval(pollRef.current);
  }, [isOnline]);

  const pollNearbyRequests = async () => {
    try {
      const data = await api.get('/rides/requests/nearby');
      if (Array.isArray(data) && data.length > 0) {
        setRideRequests(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRequests = data
            .filter(r => !existingIds.has(r.id) && !sentOffers.has(r.id))
            .map(r => ({ ...r, _shownAt: r._shownAt || Date.now() }));
          if (newRequests.length === 0) return prev;
          newRequests.forEach(r => {
            if (!seenRequestsRef.current.has(r.id)) {
              seenRequestsRef.current.add(r.id);
              notify('Nouvelle course !', {
                body: `${r.passenger_name} · ${r.proposed_price} F · ${((r.estimated_distance_m || 0) / 1000).toFixed(1)} km`,
                tag: `request-${r.id}`,
              });
            }
          });
          return [...newRequests, ...prev];
        });
      }
    } catch {}
  };

  useEffect(() => {
    if (rideRequests.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setRideRequests(prev => {
        const filtered = prev.filter(r => {
          if (new Date(r.expires_at).getTime() <= now) return false;
          if (r._shownAt && (now - r._shownAt) > 60000) return false;
          return true;
        });
        if (filtered.length < prev.length) stopSound();
        return filtered;
      });
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

  const geoRestRef = useRef(null);

  useEffect(() => {
    if (isOnline) {
      startGeoRestPolling();
    } else {
      stopGeoRestPolling();
    }
    return () => stopGeoRestPolling();
  }, [isOnline]);

  const [gpsOk, setGpsOk] = useState(false);

  const startGeoRestPolling = () => {
    if (geoRestRef.current) return;
    geoRestRef.current = navigator.geolocation?.watchPosition(
      (pos) => {
        setGpsOk(true);
        api.post('/drivers/location', {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => {});
      },
      (err) => {
        setGpsOk(false);
        console.warn('[Driver GPS]', err.message);
      },
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
      if (!isOnline) await requestPermission();
      await api.post(isOnline ? '/drivers/go-offline' : '/drivers/go-online');
      setIsOnline(!isOnline);
    } catch (e) { setError(e.message); }
    setToggling(false);
  };

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
        if (data.type === 'ride_status_changed' && data.ride) {
          navigate(`/driver/ride/${data.ride.id}`);
        }
      } catch {}
    };

    ws.onclose = () => {
      requestsWsRef.current = null;
      setTimeout(() => {
        if (isOnline && !requestsWsRef.current) connectRequestsWs();
      }, 3000);
    };

    requestsWsRef.current = ws;
  }, [isOnline, navigate]);

  const connectLocationWs = useCallback(() => {
    if (locationWsRef.current) return;
    const token = localStorage.getItem('mb_access');
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/ws/driver/location/?token=${token}`);

    ws.onopen = () => {
      console.log('[WS] Location connected');
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
      requestsWsRef.current.onclose = null;
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
    stopSound();
    setSendingOffer(requestId);
    try {
      await api.post('/rides/offers', {
        ride_request_id: requestId,
        offered_price: price,
      });
      setSentOffers(prev => new Set([...prev, requestId]));
      setShowCounter(prev => ({ ...prev, [requestId]: false }));
      setTimeout(checkActiveRide, 2000);
    } catch (e) {
      setRideRequests(prev => prev.filter(r => r.id !== requestId));
      const msg = e.message || '';
      if (msg.includes('introuvable') || msg.includes('expirée')) {
        if (typeof window !== 'undefined') {
          const toastEl = document.createElement('div');
          toastEl.className = 'fixed top-4 left-4 right-4 z-[200] bg-amber-500 text-white px-4 py-3 rounded-2xl shadow-lg text-center text-sm font-semibold';
          toastEl.textContent = `⚠️ ${t('driver.passengerCancelled')}`;
          document.body.appendChild(toastEl);
          setTimeout(() => toastEl.remove(), 3000);
        }
      } else {
        alert(e.message);
      }
    }
    setSendingOffer(null);
  };

  const getDriverTimeLeft = (req) => {
    if (!req._shownAt) return '60s';
    const elapsed = Math.floor((Date.now() - req._shownAt) / 1000);
    return `${Math.max(0, 60 - elapsed)}s`;
  };

  const getTimePct = (req) => {
    if (!req._shownAt) return 100;
    const elapsed = (Date.now() - req._shownAt) / 1000;
    return Math.max(0, ((60 - elapsed) / 60) * 100);
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* === Header === */}
      <div className={`transition-colors duration-500 ${isOnline ? 'bg-brand-600' : 'bg-gray-900'}`}>
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/60 text-xs font-medium">{t('greeting.morning')}</p>
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
                  <p className="text-white/50 text-[9px]">{t('driver.credit')}</p>
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
              <span className="text-white/80 text-xs">{t('driver.onlineSince')}</span>
              <span className="text-white font-mono font-bold text-sm">{stats.onlineTimer}</span>
              {!gpsOk && (
                <span className="text-yellow-300 text-[10px] ml-2">⚠ {t('passenger.gpsWaiting')}</span>
              )}
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
                      {isOnline ? t('driver.online') : t('driver.offline')}
                    </span>
                  </>
                )}
              </div>
            </motion.button>
            <p className="text-white/50 text-xs mt-3">
              {isOnline ? t('driver.receivingRequests') : t('driver.goOnline')}
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
              <p className="text-white/40 text-[10px]">{t('driver.earnings')}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"
            >
              <Car size={16} className="mx-auto text-blue-400" />
              <p className="text-white font-bold text-lg mt-1">{stats.todayCount}</p>
              <p className="text-white/40 text-[10px]">{t('driver.ridesCount')}</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/5"
            >
              <Star size={16} className="mx-auto text-yellow-400" />
              <p className="text-white font-bold text-lg mt-1">
                {profile ? Number(profile.average_rating).toFixed(1) : '—'}
              </p>
              <p className="text-white/40 text-[10px]">{t('driver.ratingLabel')}</p>
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
              <p className="text-sm font-semibold text-yellow-800">{t('driver.credit')}</p>
              <p className="text-xs text-yellow-600">{t('driver.recharge')}</p>
            </div>
            <Button size="sm" variant="gold" onClick={() => navigate('/driver/credit')}>{t('driver.recharge')}</Button>
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
              {t('driver.pendingRequests')}
              {rideRequests.length > 0 && (
                <span className="ml-2 bg-brand-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {rideRequests.length}
                </span>
              )}
            </h3>

            {rideRequests.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white rounded-2xl p-10 shadow-soft text-center"
              >
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 border-2 border-brand-200 border-t-brand-500 rounded-full mx-auto"
                />
                <p className="text-gray-700 font-medium mt-5">{t('driver.searchingRides')}</p>
                <p className="text-gray-400 text-sm mt-1">{t('driver.nearbyRequests')}</p>
              </motion.div>
            ) : (
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
                        exit={{ opacity: 0, x: -200, scale: 0.8 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden"
                      >
                        {/* Barre de progression 60s */}
                        <div className="h-1 bg-gray-100">
                          <motion.div
                            className={`h-full transition-all duration-1000 ${
                              getTimePct(req) > 30 ? 'bg-brand-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${getTimePct(req)}%` }}
                          />
                        </div>

                        {/* En-tête */}
                        <div className="flex items-center justify-between px-5 pt-4 pb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-brand-50 rounded-2xl flex items-center justify-center overflow-hidden">
                              {req.passenger_avatar ? (
                                <img src={req.passenger_avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-lg">{req.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{req.passenger_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-400">
                                  {req.distance_to_pickup_m
                                    ? `${(req.distance_to_pickup_m / 1000).toFixed(1)} km ${t('driver.fromYou')}`
                                    : `${((req.estimated_distance_m || 0) / 1000).toFixed(1)} km`
                                  }
                                </span>
                                {req.luggage_type && req.luggage_type !== 'none' && (
                                  <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                                    {{ small: `🎒 ${t('request.luggage.small')}`, suitcase: `🧳 ${t('request.luggage.suitcase')}`, large: `📦 ${t('request.luggage.large')}` }[req.luggage_type]}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-brand-600">{req.proposed_price}</p>
                            <p className="text-[10px] text-gray-400 font-medium">{t('common.fcfa')}</p>
                          </div>
                        </div>

                        {/* Trajet */}
                        <div className="px-5 py-3">
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center pt-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                              <div className="w-0.5 h-6 bg-gray-200 my-0.5" />
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm text-gray-700 line-clamp-1">{req.pickup_address || t('request.myPosition')}</p>
                              <p className="text-sm text-gray-700 line-clamp-1">{req.dropoff_address}</p>
                            </div>
                          </div>
                        </div>

                        {/* Timer + prix suggéré */}
                        <div className="flex items-center justify-between px-5 py-2">
                          <div className="flex items-center gap-1.5">
                            <Timer size={13} className={getTimePct(req) > 30 ? 'text-brand-500' : 'text-red-500'} />
                            <span className={`text-xs font-mono font-bold ${getTimePct(req) > 30 ? 'text-brand-600' : 'text-red-600'}`}>
                              {getDriverTimeLeft(req)}
                            </span>
                          </div>
                          {req.suggested_price !== req.proposed_price && (
                            <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                              {t('driver.suggestedPrice')} : {req.suggested_price} F
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="px-5 pb-4 pt-1">
                          {alreadySent ? (
                            <motion.div
                              initial={{ scale: 0.9 }}
                              animate={{ scale: 1 }}
                              className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-2xl"
                            >
                              <CheckCircle size={18} className="text-green-600" />
                              <span className="text-sm font-bold text-green-700">{t('driver.offerSent')}</span>
                            </motion.div>
                          ) : (
                            <div className="space-y-2">
                              {/* Bouton accepter principal */}
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => sendOffer(req.id, req.proposed_price)}
                                disabled={isSending}
                                className="w-full bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold py-3.5 rounded-2xl
                                           flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                              >
                                {isSending && !isCounterOpen ? (
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <>
                                    <Send size={16} />
                                    {t('driver.acceptPrice')} — {req.proposed_price} F
                                  </>
                                )}
                              </motion.button>

                              {/* Contre-offre toggle */}
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setShowCounter(p => ({ ...p, [req.id]: !p[req.id] }))}
                                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                                  isCounterOpen
                                    ? 'bg-brand-50 text-brand-600 border-2 border-brand-200'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                }`}
                              >
                                <TrendingUp size={14} />
                                {isCounterOpen ? t('common.close') : t('driver.proposeOtherPrice')}
                              </motion.button>

                              {/* Contre-offre input */}
                              <AnimatePresence>
                                {isCounterOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="flex items-center gap-2 pt-1">
                                      <div className="flex-1 relative">
                                        <input
                                          type="number"
                                          placeholder={t('driver.yourPrice')}
                                          value={counterPrices[req.id] || ''}
                                          onChange={e => setCounterPrices(p => ({ ...p, [req.id]: e.target.value }))}
                                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl text-center font-bold text-xl
                                                     focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">F</span>
                                      </div>
                                      <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        disabled={isSending}
                                        onClick={() => {
                                          const price = parseInt(counterPrices[req.id]);
                                          if (!price || price < 100) return alert(t('driver.priceInvalid'));
                                          sendOffer(req.id, price);
                                        }}
                                        className="bg-brand-500 text-white font-bold px-5 py-3 rounded-2xl hover:bg-brand-600 transition disabled:opacity-50"
                                      >
                                        {isSending ? '...' : t('common.send')}
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
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
            <h3 className="font-semibold text-gray-800">{t('common.home')}</h3>
            {[
              { icon: Wallet, label: t('driver.recharge'), desc: `${t('driver.currentBalance')} : ${credit?.balance || 0} ${t('common.fcfa')}`, to: '/driver/credit', color: 'bg-blue-50 text-blue-600' },
              { icon: Clock, label: t('common.history'), desc: `${stats.weeklyRides} ${t('driver.ridesCount')}`, to: '/driver/history', color: 'bg-purple-50 text-purple-600' },
              { icon: Star, label: t('common.profile'), desc: `${t('driver.ratingLabel')} : ${profile ? Number(profile.average_rating).toFixed(1) : '—'}/5`, to: '/driver/profile', color: 'bg-yellow-50 text-yellow-600' },
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

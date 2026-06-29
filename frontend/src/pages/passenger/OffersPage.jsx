import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Navigation, Clock, X, AlertCircle, TrendingUp, RefreshCw, ArrowLeft } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useNotifications } from '../../hooks/useNotifications';
import { addRecentDestination } from './HomePage';

const TIMEOUT_SECONDS = 120;

export default function OffersPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [request, setRequest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const { notify, requestPermission } = useNotifications();
  const prevOffersCount = useState(0);

  useEffect(() => {
    requestPermission();
    loadRequest();
    const interval = setInterval(loadOffers, 3000);
    return () => clearInterval(interval);
  }, []);

  // Timer d'attente
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        if (next >= TIMEOUT_SECONDS && offers.length === 0) setTimedOut(true);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [offers.length]);

  const loadRequest = async () => {
    try {
      const data = await api.get(`/rides/requests/${requestId}`);
      setRequest(data);
      setOffers(data.offers?.filter(o => o.status === 'pending') || []);
    } catch {}
  };

  const loadOffers = async () => {
    try {
      const data = await api.get(`/rides/requests/${requestId}/offers`);
      // Notification quand une nouvelle offre arrive
      if (data.length > offers.length && offers.length > 0) {
        const latest = data[data.length - 1];
        notify('Nouvelle offre reçue !', {
          body: `${latest.driver_name} propose ${latest.offered_price} F`,
          tag: 'new-offer',
        });
      }
      setOffers(data);
      if (data.length > 0) setTimedOut(false);
    } catch {}
  };

  const acceptOffer = async (offerId) => {
    setAccepting(offerId);
    navigator.vibrate?.(15);
    try {
      const ride = await api.post(`/rides/requests/${requestId}/accept-offer`, { offer_id: offerId });
      // Sauvegarder comme destination récente
      if (request) {
        addRecentDestination({
          address: request.dropoff_address || request.dropoff_address,
          coords: [request.dropoff_lat, request.dropoff_lng],
        });
      }
      navigate(`/tracking/${ride.id}`);
    } catch (e) {
      toast.show(e.message || 'Erreur', 'error');
      setAccepting(null);
    }
  };

  const cancelRequest = async () => {
    try {
      await api.post(`/rides/requests/${requestId}/cancel`);
      navigate('/');
    } catch {}
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // Barre de prix : position relative du prix du chauffeur
  const PriceBar = ({ offeredPrice }) => {
    if (!request) return null;
    const min = request.min_price || request.suggested_price * 0.5;
    const max = request.max_price || request.suggested_price * 1.5;
    const range = max - min || 1;
    const proposedPct = Math.min(100, Math.max(0, ((request.proposed_price - min) / range) * 100));
    const offeredPct = Math.min(100, Math.max(0, ((offeredPrice - min) / range) * 100));

    return (
      <div className="mt-2 mb-1">
        <div className="relative h-1.5 bg-gray-100 rounded-full">
          {/* Barre remplie */}
          <div
            className="absolute h-full bg-gradient-to-r from-green-400 to-yellow-400 rounded-full"
            style={{ width: `${Math.max(offeredPct, proposedPct)}%` }}
          />
          {/* Marqueur prix proposé */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-brand-500 rounded-full border-2 border-white shadow-sm"
            style={{ left: `${proposedPct}%` }}
            title="Votre prix"
          />
          {/* Marqueur prix chauffeur */}
          {offeredPrice !== request.proposed_price && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-yellow-500 rounded-full border-2 border-white shadow-sm"
              style={{ left: `${offeredPct}%` }}
              title="Prix chauffeur"
            />
          )}
        </div>
        <div className="flex justify-between mt-1 text-[9px] text-gray-400">
          <span>Votre prix: {request.proposed_price} F</span>
          {offeredPrice !== request.proposed_price && <span>Chauffeur: {offeredPrice} F</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header */}
      <div className="bg-brand-500 px-5 pt-5 pb-8 text-white">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-white/10">
            <ArrowLeft size={22} />
          </button>
          <div className="flex-1">
            <p className="text-brand-200 text-xs">Votre proposition</p>
            <p className="text-2xl font-bold">{request?.proposed_price || '—'} F CFA</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <p className="text-brand-100 text-sm font-mono">{formatTime(elapsed)}</p>
            </div>
            <p className="text-brand-200 text-xs">{request?.notified_count || 0} chauffeurs</p>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="px-5 -mt-3">
        {/* Timeout : aucun chauffeur après 2 min */}
        {timedOut && offers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-card p-6 text-center"
          >
            <div className="w-16 h-16 bg-yellow-50 rounded-full mx-auto flex items-center justify-center mb-4">
              <AlertCircle size={32} className="text-yellow-500" />
            </div>
            <h3 className="font-bold text-gray-800 text-lg">Aucun chauffeur disponible</h3>
            <p className="text-gray-500 text-sm mt-2 mb-5">
              Aucune offre reçue après {Math.floor(TIMEOUT_SECONDS / 60)} minutes. Essayez ces options :
            </p>

            <div className="space-y-2">
              <button
                onClick={() => { setTimedOut(false); setElapsed(0); }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-brand-50 rounded-2xl text-left hover:bg-brand-100 transition"
              >
                <RefreshCw size={18} className="text-brand-500" />
                <div>
                  <p className="text-sm font-semibold text-brand-700">Relancer la recherche</p>
                  <p className="text-xs text-brand-500">Attendre encore 2 minutes</p>
                </div>
              </button>
              <button
                onClick={() => navigate('/request')}
                className="w-full flex items-center gap-3 px-4 py-3 bg-yellow-50 rounded-2xl text-left hover:bg-yellow-100 transition"
              >
                <TrendingUp size={18} className="text-yellow-600" />
                <div>
                  <p className="text-sm font-semibold text-yellow-700">Augmenter le prix</p>
                  <p className="text-xs text-yellow-600">Un prix plus élevé attire plus de chauffeurs</p>
                </div>
              </button>
              <button
                onClick={cancelRequest}
                className="w-full py-3 text-red-500 text-sm font-medium rounded-xl hover:bg-red-50 transition"
              >
                Annuler la demande
              </button>
            </div>
          </motion.div>
        ) : offers.length === 0 ? (
          /* Écran d'attente immersif */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-3xl shadow-card overflow-hidden"
          >
            {/* Radar animé */}
            <div className="relative flex items-center justify-center py-10 bg-gradient-to-b from-brand-50 to-white">
              {/* Cercles de radar qui pulsent */}
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="absolute w-32 h-32 rounded-full border-2 border-brand-300/40"
                  animate={{ scale: [1, 2.5, 2.5], opacity: [0.6, 0, 0] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
                />
              ))}
              {/* Cercle central avec icône */}
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative z-10 w-20 h-20 bg-brand-500 rounded-full flex items-center justify-center shadow-lg"
              >
                <span className="text-3xl">{request?.vehicle_type === 'car' ? '🚗' : '🏍️'}</span>
              </motion.div>
            </div>

            <div className="px-6 pb-6">
              {/* Titre */}
              <h3 className="font-bold text-gray-800 text-lg text-center mb-1">
                Recherche en cours...
              </h3>
              <p className="text-gray-400 text-xs text-center mb-5">
                {request?.notified_count || 0} chauffeur{(request?.notified_count || 0) > 1 ? 's' : ''} notifié{(request?.notified_count || 0) > 1 ? 's' : ''}
              </p>

              {/* Étapes de progression */}
              <div className="space-y-3 mb-5">
                {[
                  { label: 'Demande envoyée', done: elapsed >= 0, active: elapsed < 3 },
                  { label: 'Chauffeurs notifiés', done: elapsed >= 3, active: elapsed >= 3 && elapsed < 10 },
                  { label: 'En attente de réponses', done: false, active: elapsed >= 10 },
                ].map((step, i) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                      step.done ? 'bg-brand-500' : step.active ? 'bg-brand-100' : 'bg-gray-100'
                    }`}>
                      {step.done ? (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : step.active ? (
                        <div className="w-2.5 h-2.5 bg-brand-500 rounded-full animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 bg-gray-300 rounded-full" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      step.done ? 'text-brand-700' : step.active ? 'text-gray-800' : 'text-gray-400'
                    }`}>{step.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* Tips rotatifs */}
              <motion.div
                key={Math.floor(elapsed / 8) % 4}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-brand-50 rounded-2xl p-4 flex items-start gap-3"
              >
                <span className="text-lg flex-shrink-0">
                  {['💡', '🔒', '💰', '⭐'][Math.floor(elapsed / 8) % 4]}
                </span>
                <div>
                  <p className="text-xs font-semibold text-brand-700">
                    {['Le saviez-vous ?', 'Sécurité', 'Bon plan', 'Qualité'][Math.floor(elapsed / 8) % 4]}
                  </p>
                  <p className="text-xs text-brand-600 mt-0.5">
                    {[
                      'Vous pouvez proposer votre propre prix. Les chauffeurs décident de l\'accepter ou de faire une contre-offre.',
                      'Tous les chauffeurs sont vérifiés. Vous pouvez partager votre trajet en temps réel avec vos proches.',
                      'Plus votre prix est proche du prix suggéré, plus vite vous recevrez des offres.',
                      'Après chaque course, notez votre chauffeur pour aider la communauté.',
                    ][Math.floor(elapsed / 8) % 4]}
                  </p>
                </div>
              </motion.div>

              {/* Timer + Annuler */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <Clock size={14} className="text-gray-400" />
                <span className="text-sm text-gray-500 font-mono">{formatTime(elapsed)}</span>
              </div>
              <button
                onClick={cancelRequest}
                className="w-full mt-4 py-3 text-red-500 text-sm font-semibold rounded-2xl border border-red-200 hover:bg-red-50 transition"
              >
                Annuler la demande
              </button>
            </div>
          </motion.div>
        ) : (
          /* Liste des offres */
          <div className="space-y-4">
            {/* Bandeau offres reçues */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center">
                  <span className="text-sm">🎉</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">
                    {offers.length} offre{offers.length > 1 ? 's' : ''} reçue{offers.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-gray-400">Choisissez votre chauffeur</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-green-50 px-2.5 py-1 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-[10px] text-green-600 font-medium">En direct</span>
              </div>
            </div>

            <AnimatePresence>
              {offers.map((offer, i) => {
                const eta = Math.max(1, Math.ceil((offer.estimated_arrival_s || 60) / 60));
                const dist = ((offer.driver_distance_m || 0) / 1000).toFixed(1);
                const isCounter = offer.is_counter_offer;
                const priceDiff = offer.offered_price - (request?.proposed_price || 0);

                return (
                  <motion.div
                    key={offer.id}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.1, type: 'spring', damping: 20 }}
                    className="bg-white rounded-3xl shadow-md border border-gray-100 overflow-hidden"
                  >
                    {/* Badge contre-offre */}
                    {isCounter && (
                      <div className="bg-amber-50 px-4 py-1.5 flex items-center gap-2">
                        <TrendingUp size={12} className="text-amber-600" />
                        <span className="text-xs font-semibold text-amber-700">
                          Contre-offre ({priceDiff > 0 ? '+' : ''}{priceDiff} F)
                        </span>
                      </div>
                    )}

                    <div className="p-4">
                      {/* Chauffeur + Prix */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-2xl flex-shrink-0">
                          {offer.driver_vehicle_type === 'moto' ? '🏍️' : '🚗'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 text-base">{offer.driver_name}</p>
                            {offer.driver_rating > 0 && (
                              <span className="flex items-center gap-0.5 text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                                ⭐ {Number(offer.driver_rating).toFixed(1)}
                              </span>
                            )}
                          </div>
                          {offer.driver_vehicle_info && (
                            <p className="text-xs text-gray-400 mt-0.5">{offer.driver_vehicle_info}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-brand-600">{offer.offered_price}</p>
                          <p className="text-[10px] text-gray-400 font-medium">F CFA</p>
                        </div>
                      </div>

                      {/* Stats : distance + ETA */}
                      <div className="flex gap-2 mb-4">
                        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-xs text-gray-400">Distance</p>
                          <p className="font-bold text-gray-700 text-sm">{dist} km</p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-xs text-gray-400">Arrivée</p>
                          <p className="font-bold text-gray-700 text-sm">~{eta} min</p>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                          <p className="text-xs text-gray-400">Votre prix</p>
                          <p className="font-bold text-gray-700 text-sm">{request?.proposed_price} F</p>
                        </div>
                      </div>

                      {/* Barre de prix visuelle */}
                      <PriceBar offeredPrice={offer.offered_price} />

                      {/* Boutons Accepter / Refuser */}
                      <div className="flex gap-2 mt-3">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => acceptOffer(offer.id)}
                          disabled={accepting === offer.id}
                          className="flex-1 bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold py-3.5 rounded-2xl
                                     flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                        >
                          {accepting === offer.id ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>✓ Accepter — {offer.offered_price} F</>
                          )}
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            // Refuser : retirer l'offre de la liste localement
                            setOffers(prev => prev.filter(o => o.id !== offer.id));
                          }}
                          className="px-4 py-3.5 border-2 border-red-200 text-red-500 rounded-2xl hover:bg-red-50 transition font-semibold text-sm"
                        >
                          ✗
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Annuler la demande en bas */}
            <button
              onClick={cancelRequest}
              className="w-full py-3 text-red-500 text-sm font-semibold rounded-2xl border border-red-200 hover:bg-red-50 transition mt-2"
            >
              Annuler la demande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

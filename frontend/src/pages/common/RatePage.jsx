import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Home, CheckCircle, Heart } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import { useTranslation } from '../../i18n/useTranslation';

const TIP_AMOUNTS = [0, 100, 200, 500];

export default function RatePage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const { isDriver } = useAuth();
  const { t } = useTranslation();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [ride, setRide] = useState(null);
  const [tip, setTip] = useState(0);

  const homePath = isDriver ? '/driver' : '/';

  useEffect(() => {
    api.get(`/rides/${rideId}`).then(setRide).catch(() => {});
  }, [rideId]);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/ratings/', { ride_id: rideId, score, comment });
      setDone(true);
    } catch {
      setDone(true);
    }
  };

  const goHome = () => navigate(homePath);

  if (done) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-white px-8">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
          <div className="text-6xl">⭐</div>
        </motion.div>
        <h2 className="text-2xl font-bold mt-6">{t('rating.thanks')}</h2>
        <p className="text-gray-500 mt-2 text-center">
          {isDriver ? t('rating.thanksSaved') : t('rating.thanksSub')}
        </p>
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileTap={{ scale: 0.97 }}
          onClick={goHome}
          className="mt-8 bg-brand-500 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-2 shadow-md hover:bg-brand-600 transition"
        >
          <Home size={18} />
          {isDriver ? t('rating.searchPassenger') : t('rating.newRide')}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          {/* Résumé course */}
          {ride && (
            <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-6 flex items-center gap-3">
              <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
              <div className="text-left flex-1">
                <p className="text-sm font-semibold text-green-800">{t('rating.rideCompleted')}</p>
                <p className="text-xs text-green-600">{ride.pickup_address} → {ride.dropoff_address}</p>
              </div>
              <p className="font-bold text-green-700">{ride.agreed_price} F</p>
            </div>
          )}

          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800">
            {isDriver ? t('rating.ratePassenger') : t('rating.rateDriver')}
          </h2>
          <p className="text-gray-500 mt-1 mb-8">
            {isDriver ? t('rating.howWasPassenger') : t('rating.howWasRide')}
          </p>

          {/* Étoiles */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <motion.button
                key={i}
                whileTap={{ scale: 1.3 }}
                onClick={() => { setScore(i); navigator.vibrate?.(10); }}
                className="p-1"
              >
                <Star
                  size={44}
                  className={`transition-all duration-200 ${
                    i <= score ? 'text-gold fill-gold' : 'text-gray-300'
                  }`}
                  fill={i <= score ? '#FFCD00' : 'none'}
                />
              </motion.button>
            ))}
          </div>

          <p className="text-sm text-gray-500 mb-6">
            {score === 5 ? t('rating.excellent') : score >= 4 ? t('rating.veryGood') : score >= 3 ? t('rating.good') : score >= 2 ? t('rating.bad') : t('rating.terrible')}
          </p>

          {/* Pourboire (passager uniquement) */}
          {!isDriver && (
            <div className="mb-5">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Heart size={14} className="text-pink-500" />
                <p className="text-sm font-semibold text-gray-600">{t('rating.tip')}</p>
              </div>
              <div className="flex justify-center gap-2">
                {TIP_AMOUNTS.map(amount => (
                  <motion.button
                    key={amount}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setTip(amount); navigator.vibrate?.(10); }}
                    className={`px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                      tip === amount
                        ? amount === 0
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {amount === 0 ? t('common.no') : `${amount} F`}
                  </motion.button>
                ))}
              </div>
              {tip > 0 && (
                <p className="text-xs text-pink-500 text-center mt-2">
                  {t('rating.tipThanks')} 💕
                </p>
              )}
            </div>
          )}

          {/* Commentaire */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={t('rating.comment')}
            maxLength={500}
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 mb-6"
          />

          <Button onClick={submit} loading={loading}>
            {t('rating.sendRating')}
          </Button>

          <button
            onClick={goHome}
            className="mt-3 text-gray-400 text-sm hover:text-gray-600 py-2"
          >
            {isDriver ? t('rating.skipAndSearch') : t('common.skip')}
          </button>
        </motion.div>
      </div>
    </div>
  );
}

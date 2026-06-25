import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ArrowLeft } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';

export default function RatePage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const { isDriver } = useAuth();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await api.post('/ratings/', { ride_id: rideId, score, comment });
      setDone(true);
      setTimeout(() => navigate(isDriver ? '/driver' : '/'), 2000);
    } catch {
      navigate(isDriver ? '/driver' : '/');
    }
  };

  if (done) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-white px-8">
        <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
          <div className="text-6xl">⭐</div>
        </motion.div>
        <h2 className="text-2xl font-bold mt-6">Merci !</h2>
        <p className="text-gray-500 mt-2">Votre avis aide la communauté</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      <div className="px-5 pt-4">
        <button onClick={() => navigate(isDriver ? '/driver' : '/')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm text-center"
        >
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800">Comment c'était ?</h2>
          <p className="text-gray-500 mt-1 mb-8">Notez votre expérience</p>

          {/* Étoiles */}
          <div className="flex justify-center gap-2 mb-8">
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

          <p className="text-sm text-gray-500 mb-2">
            {score === 5 ? 'Excellent !' : score >= 4 ? 'Très bien' : score >= 3 ? 'Correct' : score >= 2 ? 'Peut mieux faire' : 'Décevant'}
          </p>

          {/* Commentaire */}
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Un commentaire ? (optionnel)"
            maxLength={500}
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none
                       focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 mb-6"
          />

          <Button onClick={submit} loading={loading}>
            Envoyer ma note
          </Button>

          <button
            onClick={() => navigate(isDriver ? '/driver' : '/')}
            className="mt-3 text-gray-400 text-sm hover:text-gray-600"
          >
            Passer
          </button>
        </motion.div>
      </div>
    </div>
  );
}

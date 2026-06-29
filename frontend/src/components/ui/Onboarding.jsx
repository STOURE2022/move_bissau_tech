import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MapPin, DollarSign, Shield, Star } from 'lucide-react';

const SLIDES = [
  {
    emoji: '📍',
    icon: MapPin,
    title: 'Choisissez votre destination',
    desc: 'Recherchez un lieu ou touchez la carte pour définir votre trajet.',
    color: 'from-brand-500 to-emerald-500',
  },
  {
    emoji: '💰',
    icon: DollarSign,
    title: 'Proposez votre prix',
    desc: 'Contrairement aux autres apps, c\'est vous qui décidez combien payer. Les chauffeurs vous envoient leurs offres.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    emoji: '🏍️',
    icon: Shield,
    title: 'Choisissez votre chauffeur',
    desc: 'Comparez les offres, voyez la note et la distance de chaque chauffeur. Vous choisissez le meilleur.',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    emoji: '⭐',
    icon: Star,
    title: 'Voyagez en sécurité',
    desc: 'Suivi GPS en temps réel, partage de trajet, bouton SOS. Notez votre chauffeur après chaque course.',
    color: 'from-purple-500 to-pink-500',
  },
];

/**
 * Tutoriel onboarding affiché à la première connexion du passager.
 * Stocke mb_onboarded=1 dans localStorage une fois terminé.
 */
export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const next = () => {
    if (isLast) {
      localStorage.setItem('mb_onboarded', '1');
      onComplete();
    } else {
      setCurrent(c => c + 1);
    }
  };

  const skip = () => {
    localStorage.setItem('mb_onboarded', '1');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col">
      {/* Skip */}
      <div className="px-5 pt-5 flex justify-end">
        {!isLast && (
          <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600 py-1 px-3">
            Passer
          </button>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-sm text-center"
          >
            {/* Icône */}
            <div className={`w-28 h-28 mx-auto rounded-[2rem] bg-gradient-to-br ${slide.color} flex items-center justify-center shadow-lg mb-8`}>
              <span className="text-5xl">{slide.emoji}</span>
            </div>

            <h2 className="text-2xl font-extrabold text-gray-800 mb-3">{slide.title}</h2>
            <p className="text-gray-500 leading-relaxed">{slide.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-8 pb-10">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 bg-brand-500' : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl
                     flex items-center justify-center gap-2 shadow-md transition-colors"
        >
          {isLast ? 'C\'est parti !' : 'Suivant'}
          <ChevronRight size={18} />
        </motion.button>
      </div>
    </div>
  );
}

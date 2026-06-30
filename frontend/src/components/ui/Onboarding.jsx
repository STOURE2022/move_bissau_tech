import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MapPin, DollarSign, Shield, Star } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export default function Onboarding({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const { t } = useTranslation();

  const SLIDES = [
    { emoji: '📍', title: t('onboarding.slide1Title'), desc: t('onboarding.slide1Desc'), color: 'from-brand-500 to-emerald-500' },
    { emoji: '💰', title: t('onboarding.slide2Title'), desc: t('onboarding.slide2Desc'), color: 'from-yellow-500 to-orange-500' },
    { emoji: '🏍️', title: t('onboarding.slide3Title'), desc: t('onboarding.slide3Desc'), color: 'from-blue-500 to-indigo-500' },
    { emoji: '⭐', title: t('onboarding.slide4Title'), desc: t('onboarding.slide4Desc'), color: 'from-purple-500 to-pink-500' },
  ];

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
      <div className="px-5 pt-5 flex justify-end">
        {!isLast && (
          <button onClick={skip} className="text-sm text-gray-400 hover:text-gray-600 py-1 px-3">
            {t('common.skip')}
          </button>
        )}
      </div>
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
            <div className={`w-28 h-28 mx-auto rounded-[2rem] bg-gradient-to-br ${slide.color} flex items-center justify-center shadow-lg mb-8`}>
              <span className="text-5xl">{slide.emoji}</span>
            </div>
            <h2 className="text-2xl font-extrabold text-gray-800 mb-3">{slide.title}</h2>
            <p className="text-gray-500 leading-relaxed">{slide.desc}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="px-8 pb-10">
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-brand-500' : 'w-2 bg-gray-200'}`} />
          ))}
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={next}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-colors"
        >
          {isLast ? t('onboarding.letsGo') : t('common.next')}
          <ChevronRight size={18} />
        </motion.button>
      </div>
    </div>
  );
}

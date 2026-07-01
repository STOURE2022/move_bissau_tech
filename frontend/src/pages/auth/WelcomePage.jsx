import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronDown, ArrowRight, ShieldCheck, Siren, Wallet, Languages, Settings,
} from 'lucide-react';
import { useTranslation, getLang } from '../../i18n/useTranslation';
import FlagStripe from '../../components/ui/FlagStripe';

// Image de fond du hero — photo locale avec fallback gradient
function HeroBackground() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-brand-900 to-emerald-900" />
      {!failed && (
        <img
          src="/hero-bissau.jpg"
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

function LanguageSwitcher() {
  const [lang, setLangState] = useState(() => localStorage.getItem('mb_lang') || getLang());

  const switchLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('mb_lang', newLang);
    try {
      const existing = localStorage.getItem('mb_user');
      if (existing) {
        const user = JSON.parse(existing);
        user.preferred_lang = newLang;
        localStorage.setItem('mb_user', JSON.stringify(user));
      }
    } catch {}
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-full p-1">
      {[
        { code: 'fr', label: '🇫🇷 FR' },
        { code: 'pt', label: '🇵🇹 PT' },
      ].map(l => (
        <button
          key={l.code}
          onClick={() => switchLang(l.code)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
            lang === l.code ? 'bg-white text-brand-600 shadow-sm' : 'text-white/70 hover:text-white'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showSticky, setShowSticky] = useState(false);

  // Déjà connecté ? Rediriger
  useEffect(() => {
    const token = localStorage.getItem('mb_access');
    if (token) navigate('/');
  }, []);

  // CTA sticky visible seulement après avoir dépassé le hero
  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > window.innerHeight * 0.8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goRegister = (role) => {
    localStorage.setItem('mb_welcomed', '1');
    navigate('/register', role ? { state: { role } } : undefined);
  };

  const goLogin = () => {
    localStorage.setItem('mb_welcomed', '1');
    navigate('/login');
  };

  const STEPS = [
    { num: '1', emoji: '📍', title: t('welcome.step1Title'), desc: t('welcome.step1Desc') },
    { num: '2', emoji: '💰', title: t('welcome.step2Title'), desc: t('welcome.step2Desc') },
    { num: '3', emoji: '🏍️', title: t('welcome.step3Title'), desc: t('welcome.step3Desc') },
  ];

  const TRUST = [
    { icon: ShieldCheck, label: t('welcome.trustVerified') },
    { icon: Siren, label: t('welcome.trustSos') },
    { icon: Wallet, label: t('welcome.trustPayment') },
    { icon: Languages, label: t('welcome.trustLangs') },
  ];

  return (
    <div className="min-h-[100dvh] bg-white overflow-x-hidden">

      {/* ============================================ */}
      {/* HERO — photo de Bissau, plein écran */}
      {/* ============================================ */}
      <section className="relative h-[100dvh] flex flex-col overflow-hidden">
        <div className="absolute inset-0">
          <HeroBackground />
          {/* Overlay chaleureux */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-brand-900/90" />
        </div>

        {/* Barre du haut : logo + langue */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-sm font-black text-brand-500">MB</span>
            </div>
            <span className="text-white font-bold">MoveBissau</span>
          </div>
          <LanguageSwitcher />
        </div>

        {/* Contenu central */}
        <div className="flex-1 flex flex-col justify-end px-6 pb-10 relative z-10">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-yellow-300 font-bold text-lg mb-1"
          >
            No bai ! 🇬🇼
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-white text-[2.6rem] font-black leading-[1.08]"
          >
            {t('welcome.heroTitle1')}
            <br />
            {t('welcome.heroTitle2')}.
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.5 }}
            className="origin-left my-4 w-24"
          >
            <FlagStripe />
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-white/85 text-base leading-relaxed max-w-sm"
          >
            {t('welcome.heroSubtitle')}
            <strong className="text-white">{t('welcome.heroHighlight')}</strong>.
          </motion.p>

          {/* Deux CTA clairs : créer un compte / se connecter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-7 space-y-3"
          >
            <button
              onClick={() => goRegister()}
              className="w-full bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white font-bold text-base
                         py-4 rounded-2xl shadow-elevated flex items-center justify-center gap-2 transition-all"
            >
              {t('welcome.freeSignupBtn')}
              <ArrowRight size={19} />
            </button>
            <button
              onClick={goLogin}
              className="w-full bg-white/10 hover:bg-white/20 active:scale-[0.98] backdrop-blur-sm border border-white/25
                         text-white font-semibold text-base py-4 rounded-2xl transition-all"
            >
              {t('welcome.alreadyAccount')}
            </button>
            <p className="text-white/50 text-xs text-center">{t('welcome.freeSignup')}</p>
          </motion.div>
        </div>

        {/* Indicateur de scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10"
        >
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown size={18} className="text-white/40" />
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* COMMENT ÇA MARCHE — 3 étapes, compact */}
      {/* ============================================ */}
      <section className="py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          className="mb-7"
        >
          <h2 className="text-2xl font-extrabold text-gray-900">{t('welcome.howItWorks')}</h2>
          <FlagStripe className="w-16 mt-2" />
        </motion.div>

        <div className="space-y-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4"
            >
              <div className="relative w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl flex-shrink-0">
                {step.emoji}
                <span className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-brand-500 text-white rounded-full
                                 flex items-center justify-center text-[10px] font-bold">
                  {step.num}
                </span>
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">{step.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* PERSONAS — passager ou chauffeur (rôle prérempli) */}
      {/* ============================================ */}
      <section className="pb-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6"
        >
          <h2 className="text-2xl font-extrabold text-gray-900">{t('welcome.readyTitle')}</h2>
          <FlagStripe className="w-16 mt-2" />
        </motion.div>

        <div className="space-y-3">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileTap={{ scale: 0.97 }}
            onClick={() => goRegister('passenger')}
            className="w-full bg-gradient-to-r from-brand-500 to-emerald-600 text-white rounded-2xl p-5 text-left
                       flex items-center gap-4 shadow-card hover:shadow-elevated transition-shadow"
          >
            <span className="text-4xl">🧑</span>
            <div className="flex-1">
              <p className="font-bold text-lg">{t('welcome.iAmPassenger')}</p>
              <p className="text-white/75 text-sm">{t('welcome.passengerSub')}</p>
            </div>
            <ArrowRight size={22} className="text-white/70" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileTap={{ scale: 0.97 }}
            onClick={() => goRegister('driver')}
            className="w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-2xl p-5 text-left
                       flex items-center gap-4 shadow-card hover:shadow-elevated transition-shadow"
          >
            <span className="text-4xl">🏍️</span>
            <div className="flex-1">
              <p className="font-bold text-lg">{t('welcome.iAmDriver')}</p>
              <p className="text-white/75 text-sm">{t('welcome.driverSub')}</p>
            </div>
            <ArrowRight size={22} className="text-white/70" />
          </motion.button>
        </div>

        {/* Ligne de confiance */}
        <div className="grid grid-cols-2 gap-2 mt-6">
          {TRUST.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5"
            >
              <item.icon size={15} className="text-brand-600 flex-shrink-0" />
              <span className="text-xs font-medium text-gray-600">{item.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <footer className="bg-gray-50 px-6 py-8 text-center border-t">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center">
            <span className="text-xs font-bold text-white">MB</span>
          </div>
          <span className="font-bold text-gray-800">MoveBissau</span>
        </div>
        <FlagStripe className="w-14 mx-auto mb-3" />
        <p className="text-xs text-gray-400">{t('welcome.slogan')}</p>

        <div className="flex items-center justify-center gap-4 mt-4">
          <a href="/admin/" className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition">
            <Settings size={11} />
            {t('welcome.adminBtn')}
          </a>
        </div>

        <p className="text-[10px] text-gray-300 mt-3">{t('welcome.madeIn')}</p>
      </footer>

      {/* CTA sticky — apparaît après le hero */}
      <motion.div
        initial={false}
        animate={{ y: showSticky ? 0 : 110 }}
        transition={{ type: 'spring', damping: 24 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-[480px] px-5 pb-5 pt-8 bg-gradient-to-t from-white via-white/95 to-transparent">
          <button
            onClick={() => goRegister()}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-2xl shadow-elevated
                       flex items-center justify-center gap-2 transition-colors"
          >
            {t('welcome.freeSignupBtn')}
            <ArrowRight size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

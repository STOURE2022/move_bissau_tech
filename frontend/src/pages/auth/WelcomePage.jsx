import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, ChevronDown, Shield, Zap, MapPin,
  DollarSign, Star, Users, Phone, ArrowRight
} from 'lucide-react';

// Image de fond du hero — charge une photo avec fallback CSS
function HeroBackground() {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // URLs de fallback — essaie plusieurs sources
  const imageUrl = '/hero-bissau.jpg';

  return (
    <>
      {/* Fallback : gradient solide toujours visible derrière */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-brand-900 to-emerald-900" />

      {/* Photo — se superpose au gradient si elle charge */}
      {!failed && (
        <img
          src={imageUrl}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}

// Particules animées en arrière-plan
function FloatingDots() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1.5 h-1.5 bg-white/20 rounded-full"
          style={{
            left: `${10 + (i * 7.5) % 85}%`,
            top: `${15 + (i * 13) % 70}%`,
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.2, 0.5, 0.2],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Counter animé
function AnimatedCounter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const startTime = Date.now();
        const tick = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
          setCount(Math.round(eased * end));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const FEATURES = [
  {
    icon: DollarSign,
    title: 'Vous fixez le prix',
    desc: 'Proposez votre tarif. Les chauffeurs vous envoient leurs offres. Vous choisissez.',
    color: 'from-green-400 to-emerald-500',
    iconBg: 'bg-green-500',
  },
  {
    icon: Zap,
    title: 'Réponse en 2 min',
    desc: 'Des chauffeurs proches reçoivent votre demande instantanément par notification.',
    color: 'from-yellow-400 to-orange-500',
    iconBg: 'bg-yellow-500',
  },
  {
    icon: Shield,
    title: 'Trajet sécurisé',
    desc: 'Chauffeurs vérifiés, partage de trajet en direct et bouton SOS intégré.',
    color: 'from-blue-400 to-indigo-500',
    iconBg: 'bg-blue-500',
  },
  {
    icon: Phone,
    title: 'Paiement flexible',
    desc: 'Payez en espèces, Orange Money ou Moov Money. Comme vous voulez.',
    color: 'from-purple-400 to-pink-500',
    iconBg: 'bg-purple-500',
  },
];

const STEPS = [
  { num: '1', title: 'Entrez votre destination', desc: 'Recherchez ou touchez la carte', emoji: '📍' },
  { num: '2', title: 'Proposez votre prix', desc: 'Vous décidez combien payer', emoji: '💰' },
  { num: '3', title: 'Choisissez votre chauffeur', desc: 'Comparez les offres reçues', emoji: '🏍️' },
  { num: '4', title: 'Profitez du trajet', desc: 'Suivez en temps réel', emoji: '🛣️' },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: containerRef });

  // Parallax pour le hero
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  // Déjà vu le welcome ?
  useEffect(() => {
    // Si l'user revient sur /welcome mais a déjà un token, rediriger
    const token = localStorage.getItem('mb_access');
    if (token) navigate('/');
  }, []);

  const goLogin = () => {
    localStorage.setItem('mb_welcomed', '1');
    navigate('/login');
  };

  return (
    <div ref={containerRef} className="min-h-[100dvh] bg-white overflow-x-hidden">

      {/* ============================================ */}
      {/* HERO — Plein écran, immersif avec photo */}
      {/* ============================================ */}
      <section className="relative h-[100dvh] flex flex-col overflow-hidden">
        {/* Fond immersif : photo + overlay + mesh gradient */}
        <div className="absolute inset-0">
          {/* Photo de fond (chargée depuis le réseau, avec fallback) */}
          <HeroBackground />
          {/* Overlay sombre + gradient brand */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-brand-900/70 to-brand-700/85" />
          {/* Mesh gradient animé pour la profondeur */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-[100px]"
              style={{ background: 'radial-gradient(circle, #22c55e, transparent 70%)', top: '-10%', right: '-20%' }}
              animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[80px]"
              style={{ background: 'radial-gradient(circle, #FFCD00, transparent 70%)', bottom: '10%', left: '-15%' }}
              animate={{ x: [0, -20, 0], y: [0, -30, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          {/* Grain texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
          }} />
        </div>

        <FloatingDots />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="flex-1 flex flex-col items-center justify-center px-8 relative z-10"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10, delay: 0.2 }}
            className="w-24 h-24 bg-white rounded-[2rem] shadow-elevated flex items-center justify-center mb-6"
          >
            <span className="text-4xl font-black text-brand-500">MB</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-white text-4xl font-extrabold text-center leading-tight"
          >
            Déplacez-vous<br />
            <span className="text-yellow-300">à votre prix</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-brand-100 text-center mt-4 text-base max-w-xs leading-relaxed"
          >
            La première app de transport à Bissau où
            <strong className="text-white"> vous décidez du tarif</strong>.
          </motion.p>

          {/* CTA principal */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            whileTap={{ scale: 0.96 }}
            onClick={goLogin}
            className="mt-8 bg-white text-brand-600 font-bold text-lg px-8 py-4 rounded-2xl shadow-elevated
                       flex items-center gap-2 hover:shadow-xl transition-shadow"
          >
            Commencer
            <ChevronRight size={20} />
          </motion.button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="text-brand-200 text-xs mt-4"
          >
            Gratuit — inscription en 30 secondes
          </motion.p>
        </motion.div>

        {/* Indicateur de scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        >
          <span className="text-white/50 text-xs">Découvrir</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ChevronDown size={20} className="text-white/50" />
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* COMMENT ÇA MARCHE — 4 étapes */}
      {/* ============================================ */}
      <section className="py-12 px-6 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-extrabold text-gray-800">Comment ça marche ?</h2>
          <p className="text-gray-500 text-sm mt-2">Simple comme 1-2-3-4</p>
        </motion.div>

        <div className="space-y-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-soft"
            >
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                {step.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-brand-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {step.num}
                  </span>
                  <p className="font-bold text-gray-800 text-sm">{step.title}</p>
                </div>
                <p className="text-xs text-gray-500 mt-1 pl-8">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* AVANTAGES — Cards avec gradient */}
      {/* ============================================ */}
      <section className="py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-extrabold text-gray-800">Pourquoi MoveBissau ?</h2>
          <p className="text-gray-500 text-sm mt-2">Ce qui nous rend différent</p>
        </motion.div>

        <div className="space-y-4">
          {FEATURES.map((feat, i) => (
            <motion.div
              key={feat.title}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-3xl p-5 bg-gradient-to-br ${feat.color} text-white`}
            >
              {/* Cercle décoratif */}
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full" />

              <div className="relative z-10 flex items-start gap-4">
                <div className={`w-12 h-12 ${feat.iconBg} bg-opacity-30 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <feat.icon size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{feat.title}</h3>
                  <p className="text-white/80 text-sm mt-1 leading-relaxed">{feat.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* STATS — Chiffres animés */}
      {/* ============================================ */}
      <section className="py-12 px-6 bg-gray-900 text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl font-extrabold">Bissau nous fait confiance</h2>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 500, suffix: '+', label: 'Courses', icon: '🏍️' },
            { value: 120, suffix: '+', label: 'Chauffeurs', icon: '👨‍✈️' },
            { value: 98, suffix: '%', label: 'Satisfaction', icon: '⭐' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 text-center"
            >
              <span className="text-2xl">{stat.icon}</span>
              <p className="text-2xl font-extrabold mt-2 text-brand-400">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-white/50 text-xs mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* DOUBLE CTA — Passager ou Chauffeur */}
      {/* ============================================ */}
      <section className="py-12 px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl font-extrabold text-gray-800">Prêt à commencer ?</h2>
          <p className="text-gray-500 text-sm mt-2">Choisissez votre aventure</p>
        </motion.div>

        <div className="space-y-3">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileTap={{ scale: 0.97 }}
            onClick={goLogin}
            className="w-full bg-gradient-to-r from-brand-500 to-emerald-500 text-white rounded-2xl p-5 text-left
                       flex items-center gap-4 shadow-card hover:shadow-elevated transition-shadow"
          >
            <span className="text-4xl">🧑</span>
            <div className="flex-1">
              <p className="font-bold text-lg">Je suis passager</p>
              <p className="text-white/70 text-sm">Commander une course maintenant</p>
            </div>
            <ArrowRight size={22} className="text-white/70" />
          </motion.button>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            whileTap={{ scale: 0.97 }}
            onClick={goLogin}
            className="w-full bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-2xl p-5 text-left
                       flex items-center gap-4 shadow-card hover:shadow-elevated transition-shadow"
          >
            <span className="text-4xl">🏍️</span>
            <div className="flex-1">
              <p className="font-bold text-lg">Je suis chauffeur</p>
              <p className="text-white/70 text-sm">Gagner de l'argent avec mon véhicule</p>
            </div>
            <ArrowRight size={22} className="text-white/70" />
          </motion.button>
        </div>
      </section>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <footer className="bg-gray-50 px-6 py-8 text-center border-t">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center">
            <span className="text-xs font-bold text-white">MB</span>
          </div>
          <span className="font-bold text-gray-800">MoveBissau</span>
        </div>
        <p className="text-xs text-gray-400">
          Votre transport, votre prix
        </p>
        <p className="text-[10px] text-gray-300 mt-4">
          Made with ❤️ in Bissau
        </p>
      </footer>

      {/* ============================================ */}
      {/* STICKY CTA — Toujours visible en bas */}
      {/* ============================================ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center">
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          transition={{ delay: 2, type: 'spring', damping: 20 }}
          className="pointer-events-auto w-full max-w-[480px] px-5 pb-6 pt-3 bg-gradient-to-t from-white via-white/95 to-transparent"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goLogin}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-base py-4 rounded-2xl shadow-elevated
                       flex items-center justify-center gap-2 transition-colors"
          >
            S'inscrire gratuitement
            <ChevronRight size={18} />
          </motion.button>
        </motion.div>
      </div>

      {/* Espace pour le CTA sticky */}
      <div className="h-20" />
    </div>
  );
}

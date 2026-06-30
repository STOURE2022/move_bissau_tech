import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useTranslation } from '../../i18n/useTranslation';

export default function CompleteProfilePage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('passenger');
  const [lang, setLang] = useState('fr');
  const { completeProfile, loading, error } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const isValid = firstName.trim().length >= 2 && lastName.trim().length >= 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    navigator.vibrate?.(15);
    const ok = await completeProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      role,
      preferred_lang: lang,
    });
    if (ok) navigate(role === 'driver' ? '/driver' : '/');
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Header avec barre de progression */}
      <div className="px-5 pt-4 flex items-center justify-between">
        <button onClick={() => navigate('/login')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div className="flex gap-1.5">
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className="w-8 h-1 rounded-full bg-brand-500" />
        </div>
        <div className="w-10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-8 pb-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4"
          >
            <User size={32} className="text-brand-500" />
          </motion.div>
          <h2 className="text-2xl font-bold">{t('auth.welcome', 'Bienvenue !')}</h2>
          <p className="text-gray-500 mt-1 text-sm">{t('auth.lastStep', 'Dernière étape avant de commencer')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nom et prénom côte à côte */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                label={t('auth.firstName', 'Prénom')}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder={t('auth.firstName', 'Prénom')}
                autoFocus
              />
              {firstName.length > 0 && firstName.trim().length < 2 && (
                <p className="text-xs text-red-400 mt-1 pl-1">{t('auth.minChars', 'Min. 2 caractères')}</p>
              )}
            </div>
            <div>
              <Input
                label={t('auth.lastName', 'Nom')}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder={t('auth.lastName', 'Nom')}
              />
              {lastName.length > 0 && lastName.trim().length < 2 && (
                <p className="text-xs text-red-400 mt-1 pl-1">{t('auth.minChars', 'Min. 2 caractères')}</p>
              )}
            </div>
          </div>

          {/* Choix du rôle */}
          <div className="pt-2">
            <label className="text-sm font-medium text-gray-600 pl-1 block mb-2">{t('auth.chooseRole', 'Je suis...')}</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'passenger',
                  label: t('auth.passenger', 'Passager'),
                  desc: t('auth.passengerDesc', 'Commander une course'),
                  icon: '🧑',
                  features: [t('auth.featureChoosePrice', 'Choisissez votre prix'), t('auth.featureMobilePay', 'Payez par mobile money')],
                },
                {
                  value: 'driver',
                  label: t('auth.driver', 'Chauffeur'),
                  desc: t('auth.driverDesc', 'Proposer mes services'),
                  icon: '🏍️',
                  features: [t('auth.featureReceiveRequests', 'Recevez des demandes'), t('auth.featureManageRevenue', 'Gérez vos revenus')],
                },
              ].map(opt => (
                <motion.button
                  key={opt.value}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => { setRole(opt.value); navigator.vibrate?.(10); }}
                  className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                    role === opt.value
                      ? 'border-brand-500 bg-brand-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <span className="text-3xl">{opt.icon}</span>
                  <p className={`font-semibold mt-2 ${role === opt.value ? 'text-brand-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>

                  {/* Features du rôle */}
                  {role === opt.value && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 pt-2 border-t border-brand-200 space-y-1"
                    >
                      {opt.features.map(f => (
                        <p key={f} className="text-[10px] text-brand-600 flex items-center gap-1">
                          <span className="w-1 h-1 bg-brand-500 rounded-full" />
                          {f}
                        </p>
                      ))}
                    </motion.div>
                  )}

                  {role === opt.value && (
                    <div className="absolute top-3 right-3 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Langue */}
          <div className="pt-1">
            <label className="text-sm font-medium text-gray-600 pl-1 block mb-2">{t('auth.chooseLang', 'Langue préférée')}</label>
            <div className="flex gap-2">
              {[
                { code: 'fr', label: 'Français', flag: '🇫🇷' },
                { code: 'pt', label: 'Português', flag: '🇵🇹' },
                { code: 'gcr', label: 'Kriol', flag: '🇬🇼' },
              ].map(l => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => setLang(l.code)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    lang === l.code
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{l.flag}</span>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-red-500 text-sm text-center">{error}</motion.p>
          )}

          <div className="pt-3">
            <Button type="submit" loading={loading} disabled={!isValid}>
              {role === 'driver' ? `🏍️ ${t('auth.startAsDriver', 'Commencer comme chauffeur')}` : `🚀 ${t('auth.startNow', 'Commencer')}`}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Lock, Eye, EyeOff, ChevronRight, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { useTranslation } from '../../i18n/useTranslation';
import Button from '../../components/ui/Button';
import FlagStripe from '../../components/ui/FlagStripe';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const country = useCountryConfig();
  const { t } = useTranslation();

  // Détecter si le numéro est saisi avec le préfixe complet (+XXX...)
  const hasFullPrefix = phone.startsWith('+');

  // Formater le numéro : uniquement des chiffres, formaté XX XXX XXXX
  const formatPhone = (value) => {
    if (value.startsWith('+')) return value;
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  };

  const rawPhone = phone.replace(/\s/g, '');
  const isPhoneValid = hasFullPrefix
    ? /^\+\d{8,15}$/.test(rawPhone)
    : /^\d{7,9}$/.test(rawPhone);
  const isFormValid = isPhoneValid && password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    setError('');
    try {
      const fullPhone = hasFullPrefix ? rawPhone : `${country.phone_prefix}${rawPhone}`;
      const result = await login(fullPhone, password);
      if (result) {
        navigate(result.user.role === 'driver' ? '/driver' : '/');
      }
    } catch (e) {
      setError(e.message || t('auth.incorrectCredentials'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Bandeau tricolore signature */}
      <FlagStripe className="rounded-none h-1.5" />

      {/* En-tête */}
      <div className="px-5 pt-4">
        <button onClick={() => navigate('/welcome')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-2 pb-7"
      >
        <div className="w-14 h-14 bg-brand-500 rounded-2xl shadow-card flex items-center justify-center mb-5">
          <span className="text-xl font-black text-white">MB</span>
        </div>
        <h1 className="text-gray-900 text-[1.7rem] font-extrabold leading-tight">
          {t('auth.welcomeBack')} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">{t('auth.loginSubtitle')}</p>
      </motion.div>

      {/* Formulaire */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex-1 px-6 pb-10"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Téléphone */}
          <div>
            <label className="text-sm font-medium text-gray-600 pl-1 block mb-1.5">{t('auth.phone')}</label>
            <div className="flex items-center gap-2">
              {!hasFullPrefix && (
                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3.5 flex-shrink-0">
                  <span className="text-lg">{country.country_flag}</span>
                  <span className="text-sm font-semibold text-gray-700">{country.phone_prefix}</span>
                </div>
              )}
              <div className="relative flex-1">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  inputMode={hasFullPrefix ? 'tel' : 'numeric'}
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder={hasFullPrefix ? '+245 XX XXX XXXX' : '95 XXX XXXX'}
                  autoFocus
                  className={`w-full bg-gray-50 border rounded-xl pl-10 pr-4 py-3.5 text-lg font-medium tracking-wider
                    focus:outline-none focus:ring-2 transition-all
                    ${rawPhone.length > 0 && !isPhoneValid
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                      : isPhoneValid
                        ? 'border-green-300 focus:ring-green-500/20 focus:border-green-500'
                        : 'border-gray-200 focus:ring-brand-500/20 focus:border-brand-500'
                    }`}
                />
                {rawPhone.length > 0 && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center ${
                    isPhoneValid ? 'bg-green-500' : 'bg-red-400'
                  }`}>
                    {isPhoneValid ? (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-white text-xs font-bold">!</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {rawPhone.length > 0 && !isPhoneValid && (
              <p className="text-xs text-red-500 mt-1 pl-1">
                {hasFullPrefix ? 'Format : +245XXXXXXXXX' : t('auth.phoneDigits')}
              </p>
            )}
            {rawPhone.length === 0 && (
              <p className="text-xs text-gray-400 mt-1 pl-1">
                {t('auth.phoneInternational')}
              </p>
            )}
          </div>

          {/* Mot de passe */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-600 pl-1">{t('auth.password')}</label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-xs text-brand-600 font-medium hover:underline"
              >
                {t('auth.passwordForgot')}
              </button>
            </div>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('auth.passwordPlaceholder')}
                className={`w-full bg-gray-50 border rounded-xl pl-10 pr-12 py-3.5 text-sm
                  focus:outline-none focus:ring-2 transition-all
                  ${password.length > 0 && password.length < 6
                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-gray-200 focus:ring-brand-500/20 focus:border-brand-500'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-red-500 mt-1 pl-1">{t('auth.passwordMin')}</p>
            )}
          </div>

          {/* Erreur */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
            >
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}

          <Button type="submit" loading={loading} disabled={!isFormValid}>
            {t('auth.signIn')}
            <ChevronRight size={18} />
          </Button>
        </form>

        {/* Inscription — bien visible */}
        <div className="mt-5">
          <button
            onClick={() => navigate('/register')}
            className="w-full py-3.5 rounded-2xl border-2 border-brand-500 text-brand-600 font-bold text-sm
                       hover:bg-brand-50 transition"
          >
            {t('auth.noAccount')} {t('auth.signUp')}
          </button>
        </div>

        {/* Accès admin — discret */}
        <div className="text-center mt-8">
          <a
            href="/admin/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            <Shield size={12} />
            {t('auth.adminSpace')}
          </a>
        </div>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, Lock, Eye, EyeOff, ChevronRight, ArrowLeft, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import Button from '../../components/ui/Button';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();
  const country = useCountryConfig();

  // Formater le numéro : uniquement des chiffres, formaté XX XXX XXXX
  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  };

  const rawPhone = phone.replace(/\s/g, '');
  const isPhoneValid = /^\d{7,9}$/.test(rawPhone);
  const isFormValid = isPhoneValid && password.length >= 6;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    setError('');
    try {
      const fullPhone = `${country.phone_prefix}${rawPhone}`;
      const result = await login(fullPhone, password);
      if (result) {
        navigate(result.user.role === 'driver' ? '/driver' : '/');
      }
    } catch (e) {
      setError(e.message || 'Identifiants incorrects');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-brand-500 via-brand-600 to-brand-700">
      {/* Bouton retour */}
      <div className="px-4 pt-4 relative z-10">
        <button onClick={() => navigate('/welcome')} className="p-2 rounded-xl hover:bg-white/10">
          <ArrowLeft size={22} className="text-white" />
        </button>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center px-8 pt-4 pb-6"
      >
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, delay: 0.1 }}
          className="w-20 h-20 bg-white rounded-3xl shadow-elevated flex items-center justify-center mb-4"
        >
          <span className="text-3xl font-black text-brand-500">MB</span>
        </motion.div>
        <h1 className="text-white text-2xl font-bold">Connexion</h1>
        <p className="text-brand-200 mt-1 text-center text-sm">
          Entrez vos identifiants pour continuer
        </p>
      </motion.div>

      {/* Formulaire */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 20 }}
        className="flex-1 bg-white rounded-t-[2rem] px-6 pt-8 pb-10 shadow-elevated"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Téléphone */}
          <div>
            <label className="text-sm font-medium text-gray-600 pl-1 block mb-1.5">Numéro de téléphone</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3.5 flex-shrink-0">
                <span className="text-lg">{country.country_flag}</span>
                <span className="text-sm font-semibold text-gray-700">{country.phone_prefix}</span>
              </div>
              <div className="relative flex-1">
                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="95 XXX XXXX"
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
              <p className="text-xs text-red-500 mt-1 pl-1">Entrez 7 à 9 chiffres (sans lettres)</p>
            )}
          </div>

          {/* Mot de passe */}
          <div>
            <label className="text-sm font-medium text-gray-600 pl-1 block mb-1.5">Mot de passe</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
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
              <p className="text-xs text-red-500 mt-1 pl-1">Minimum 6 caractères</p>
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
            Se connecter
            <ChevronRight size={18} />
          </Button>
        </form>

        {/* Mot de passe oublié */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/forgot-password')}
            className="text-sm text-gray-400 hover:text-brand-500 transition"
          >
            Mot de passe oublié ?
          </button>
        </div>

        {/* Lien inscription */}
        <div className="text-center mt-4">
          <p className="text-sm text-gray-500">
            Pas encore de compte ?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-brand-500 font-semibold hover:underline"
            >
              S'inscrire
            </button>
          </p>
        </div>

        {/* Accès admin */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <a
            href="/admin/"
            className="flex items-center justify-center gap-2.5 w-full bg-gradient-to-r from-gray-800 to-gray-900
                       text-white font-semibold text-sm py-3.5 rounded-2xl shadow-md hover:shadow-lg
                       hover:from-gray-700 hover:to-gray-800 transition-all"
          >
            <Shield size={16} />
            Espace Administrateur
          </a>
        </div>
      </motion.div>
    </div>
  );
}

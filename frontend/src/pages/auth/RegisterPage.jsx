import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Phone, Lock, Eye, EyeOff, User, ArrowLeft, AlertCircle, CheckCircle, ChevronRight
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import Button from '../../components/ui/Button';

export default function RegisterPage() {
  const [form, setForm] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    password: '',
    passwordConfirm: '',
    role: 'passenger',
    lang: 'fr',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register } = useAuth();
  const country = useCountryConfig();

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // Formater le numéro
  const formatPhone = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  };

  const rawPhone = form.phone.replace(/\s/g, '');
  const isPhoneValid = /^\d{7,9}$/.test(rawPhone);
  const isNameValid = form.firstName.trim().length >= 2 && form.lastName.trim().length >= 2;
  const isPasswordValid = form.password.length >= 6 && !(/^\d+$/.test(form.password));
  const isPasswordMatch = form.password === form.passwordConfirm && form.passwordConfirm.length > 0;
  const isFormValid = isPhoneValid && isNameValid && isPasswordValid && isPasswordMatch;

  // Force du mot de passe
  const getPasswordStrength = () => {
    const p = form.password;
    if (p.length === 0) return { level: 0, label: '', color: '' };
    if (p.length < 6) return { level: 1, label: 'Trop court', color: 'bg-red-500' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    if (score <= 1) return { level: 2, label: 'Faible', color: 'bg-orange-500' };
    if (score <= 2) return { level: 3, label: 'Moyen', color: 'bg-yellow-500' };
    return { level: 4, label: 'Fort', color: 'bg-green-500' };
  };

  const strength = getPasswordStrength();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setLoading(true);
    setError('');
    try {
      const fullPhone = `${country.phone_prefix}${rawPhone}`;
      const result = await register({
        phone: fullPhone,
        password: form.password,
        password_confirm: form.passwordConfirm,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        role: form.role,
        preferred_lang: form.lang,
      });
      if (result) {
        navigate(form.role === 'driver' ? '/driver/setup' : '/');
      }
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'inscription');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-600 px-5 pt-4 pb-8">
        <button onClick={() => navigate('/login')} className="p-2 -ml-2 rounded-xl hover:bg-white/10 mb-2">
          <ArrowLeft size={22} className="text-white" />
        </button>
        <h1 className="text-white text-2xl font-bold">Créer un compte</h1>
        <p className="text-brand-200 text-sm mt-1">Rejoignez MoveBissau en quelques secondes</p>
      </div>

      <div className="px-6 -mt-3 pb-10">
        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-2xl">

          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3 pt-5">
            <div>
              <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Prénom</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.firstName}
                  onChange={e => set('firstName', e.target.value)}
                  placeholder="Prénom"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Nom</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                placeholder="Nom"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>
          </div>

          {/* Téléphone */}
          <div>
            <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Numéro de téléphone</label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-3 flex-shrink-0">
                <span>{country.country_flag}</span>
                <span className="text-xs font-semibold text-gray-700">{country.phone_prefix}</span>
              </div>
              <div className="relative flex-1">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={e => set('phone', formatPhone(e.target.value))}
                  placeholder="95 XXX XXXX"
                  className={`w-full bg-gray-50 border rounded-xl pl-9 pr-10 py-3 text-sm font-medium tracking-wider
                    focus:outline-none focus:ring-2 transition-all
                    ${rawPhone.length > 0 && !isPhoneValid
                      ? 'border-red-300 focus:ring-red-500/20'
                      : isPhoneValid
                        ? 'border-green-300 focus:ring-green-500/20'
                        : 'border-gray-200 focus:ring-brand-500/20'
                    }`}
                />
                {rawPhone.length > 0 && (
                  <div className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center ${isPhoneValid ? 'bg-green-500' : 'bg-red-400'}`}>
                    {isPhoneValid ? (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <span className="text-white text-[8px] font-bold">!</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {rawPhone.length > 0 && !isPhoneValid && (
              <p className="text-[11px] text-red-500 mt-1 pl-1">7 à 9 chiffres uniquement, pas de lettres</p>
            )}
          </div>

          {/* Mot de passe */}
          <div>
            <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min. 6 caractères"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {/* Barre de force */}
            {form.password.length > 0 && (
              <div className="flex items-center gap-2 mt-1.5 pl-1">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength.level ? strength.color : 'bg-gray-200'}`} />
                  ))}
                </div>
                <span className={`text-[10px] font-medium ${strength.color.replace('bg-', 'text-')}`}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirmer mot de passe */}
          <div>
            <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Confirmer le mot de passe</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.passwordConfirm}
                onChange={e => set('passwordConfirm', e.target.value)}
                placeholder="Retapez le mot de passe"
                className={`w-full bg-gray-50 border rounded-xl pl-9 pr-10 py-3 text-sm
                  focus:outline-none focus:ring-2 transition-all
                  ${form.passwordConfirm.length > 0
                    ? isPasswordMatch ? 'border-green-300 focus:ring-green-500/20' : 'border-red-300 focus:ring-red-500/20'
                    : 'border-gray-200 focus:ring-brand-500/20'
                  }`}
              />
              {form.passwordConfirm.length > 0 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isPasswordMatch
                    ? <CheckCircle size={16} className="text-green-500" />
                    : <AlertCircle size={16} className="text-red-400" />
                  }
                </div>
              )}
            </div>
            {form.passwordConfirm.length > 0 && !isPasswordMatch && (
              <p className="text-[11px] text-red-500 mt-1 pl-1">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {/* Rôle */}
          <div>
            <label className="text-xs font-medium text-gray-500 pl-1 block mb-2">Je suis...</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'passenger', label: 'Passager', emoji: '🧑', desc: 'Commander des courses' },
                { value: 'driver', label: 'Chauffeur', emoji: '🏍️', desc: 'Proposer mes services' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('role', opt.value)}
                  className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                    form.role === opt.value
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <p className={`font-semibold text-sm mt-1 ${form.role === opt.value ? 'text-brand-700' : 'text-gray-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-gray-400">{opt.desc}</p>
                  {form.role === opt.value && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Langue */}
          <div>
            <label className="text-xs font-medium text-gray-500 pl-1 block mb-2">Langue</label>
            <div className="flex gap-2">
              {[
                { code: 'fr', label: 'Français', flag: '🇫🇷' },
                { code: 'pt', label: 'Português', flag: '🇵🇹' },
                { code: 'gcr', label: 'Kriol', flag: '🇬🇼' },
              ].map(l => (
                <button key={l.code} type="button" onClick={() => set('lang', l.code)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    form.lang === l.code ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  <span>{l.flag}</span> {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}

          <div className="pt-2">
            <Button type="submit" loading={loading} disabled={!isFormValid}>
              Créer mon compte
              <ChevronRight size={18} />
            </Button>
          </div>
        </form>

        <div className="text-center mt-5">
          <p className="text-sm text-gray-500">
            Déjà un compte ?{' '}
            <button onClick={() => navigate('/login')} className="text-brand-500 font-semibold hover:underline">
              Se connecter
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

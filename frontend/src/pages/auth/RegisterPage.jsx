import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, Lock, Eye, EyeOff, User, ArrowLeft, AlertCircle, CheckCircle, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { useTranslation } from '../../i18n/useTranslation';
import Button from '../../components/ui/Button';
import FlagStripe from '../../components/ui/FlagStripe';

/**
 * Inscription en 3 étapes : rôle & langue → identité → sécurité.
 * Le rôle peut être prérempli depuis la page welcome (state.role).
 */
export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const country = useCountryConfig();

  const presetRole = location.state?.role;

  // Si le rôle est prérempli depuis welcome, sauter l'étape 1
  const [step, setStep] = useState(presetRole ? 1 : 0);
  const [form, setForm] = useState({
    phone: '',
    firstName: '',
    lastName: '',
    password: '',
    passwordConfirm: '',
    role: presetRole || '',
    lang: localStorage.getItem('mb_lang') || 'fr',
    referralCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // === Validations ===
  const hasFullPrefix = form.phone.startsWith('+');

  const formatPhone = (value) => {
    if (value.startsWith('+')) return value;
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  };

  const rawPhone = form.phone.replace(/\s/g, '');
  const isPhoneValid = hasFullPrefix
    ? /^\+\d{8,15}$/.test(rawPhone)
    : /^\d{7,9}$/.test(rawPhone);
  const isNameValid = form.firstName.trim().length >= 2 && form.lastName.trim().length >= 2;
  const isPasswordValid = form.password.length >= 6 && !(/^\d+$/.test(form.password));
  const isPasswordMatch = form.password === form.passwordConfirm && form.passwordConfirm.length > 0;

  const isStep1Valid = isNameValid && isPhoneValid;
  const isStep2Valid = isPasswordValid && isPasswordMatch;

  const getPasswordStrength = () => {
    const p = form.password;
    if (p.length === 0) return { level: 0, label: '', color: '' };
    if (p.length < 6) return { level: 1, label: t('auth.passwordStrength.tooShort'), color: 'bg-red-500' };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;
    if (score <= 1) return { level: 2, label: t('auth.passwordStrength.weak'), color: 'bg-orange-500' };
    if (score <= 2) return { level: 3, label: t('auth.passwordStrength.medium'), color: 'bg-yellow-500' };
    return { level: 4, label: t('auth.passwordStrength.strong'), color: 'bg-green-500' };
  };
  const strength = getPasswordStrength();

  // === Navigation ===
  const goBack = () => {
    setError('');
    if (step === 0 || (step === 1 && presetRole)) navigate(-1);
    else setStep(step - 1);
  };

  const chooseRole = (role) => {
    set('role', role);
    setStep(1);
  };

  // === Soumission ===
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!isStep2Valid) return;
    setLoading(true);
    setError('');
    try {
      const fullPhone = hasFullPrefix ? rawPhone : `${country.phone_prefix}${rawPhone}`;
      const regData = {
        phone: fullPhone,
        password: form.password,
        password_confirm: form.passwordConfirm,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        role: form.role,
        preferred_lang: form.lang,
      };
      if (form.referralCode.trim()) regData.referral_code = form.referralCode.trim().toUpperCase();
      const result = await register(regData);
      if (result) {
        navigate(form.role === 'driver' ? '/driver/setup' : '/');
      }
    } catch (e) {
      setError(e.message || t('auth.registerError'));
    }
    setLoading(false);
  };

  const STEP_TITLES = [
    { title: t('auth.iAm'), sub: t('auth.createAccountSubtitle') },
    { title: t('auth.stepIdentity'), sub: t('auth.stepIdentitySub') },
    { title: t('auth.stepSecurity'), sub: t('auth.stepSecuritySub') },
  ];

  const inputClass = `w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm
                      focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500`;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Bandeau tricolore signature */}
      <FlagStripe className="rounded-none h-1.5" />

      {/* En-tête + progression */}
      <div className="px-5 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          {/* Barre de progression — 3 segments */}
          <div className="flex-1 flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  initial={false}
                  animate={{ width: i <= step ? '100%' : '0%' }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-brand-500 rounded-full"
                />
              </div>
            ))}
          </div>
          <span className="text-xs font-semibold text-gray-400">{step + 1}/3</span>
        </div>
      </div>

      <div className="px-6 pt-5 pb-2">
        <h1 className="text-gray-900 text-2xl font-extrabold">{STEP_TITLES[step].title}</h1>
        <p className="text-gray-500 text-sm mt-1">{STEP_TITLES[step].sub}</p>
      </div>

      {/* Contenu de l'étape */}
      <div className="flex-1 px-6 pb-10">
        <AnimatePresence mode="wait">

          {/* ===== Étape 1 : Rôle + langue ===== */}
          {step === 0 && (
            <motion.div
              key="role"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-3 pt-3"
            >
              {[
                { value: 'passenger', label: t('auth.passenger'), emoji: '🧑', desc: t('auth.passengerDesc') },
                { value: 'driver', label: t('auth.driver'), emoji: '🏍️', desc: t('auth.driverDesc') },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => chooseRole(opt.value)}
                  className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-200 text-left
                             hover:border-brand-400 hover:bg-brand-50/40 active:scale-[0.98] transition-all"
                >
                  <span className="text-4xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800">{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                  <ChevronRight size={20} className="text-gray-300" />
                </button>
              ))}

              {/* Langue */}
              <div className="pt-4">
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-2">{t('auth.language')}</label>
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
            </motion.div>
          )}

          {/* ===== Étape 2 : Identité ===== */}
          {step === 1 && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="space-y-4 pt-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">{t('auth.firstName')}</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      placeholder={t('auth.firstName')}
                      autoFocus
                      className={`${inputClass} pl-9`}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">{t('auth.lastName')}</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => set('lastName', e.target.value)}
                    placeholder={t('auth.lastName')}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">{t('auth.phone')}</label>
                <div className="flex items-center gap-2">
                  {!hasFullPrefix && (
                    <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-3.5 flex-shrink-0">
                      <span>{country.country_flag}</span>
                      <span className="text-xs font-semibold text-gray-700">{country.phone_prefix}</span>
                    </div>
                  )}
                  <div className="relative flex-1">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      inputMode={hasFullPrefix ? 'tel' : 'numeric'}
                      value={form.phone}
                      onChange={e => set('phone', formatPhone(e.target.value))}
                      placeholder={hasFullPrefix ? '+245 XX XXX XXXX' : '95 XXX XXXX'}
                      className={`w-full bg-gray-50 border rounded-xl pl-9 pr-10 py-3.5 text-sm font-medium tracking-wider
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
                  <p className="text-[11px] text-red-500 mt-1 pl-1">{t('auth.phoneHint')}</p>
                )}
              </div>

              <div className="pt-2">
                <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
                  {t('common.next', 'Continuer')}
                  <ChevronRight size={18} />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ===== Étape 3 : Sécurité ===== */}
          {step === 2 && (
            <motion.form
              key="security"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              onSubmit={handleSubmit}
              className="space-y-4 pt-3"
            >
              {/* Mot de passe */}
              <div>
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">{t('auth.password')}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    autoFocus
                    className={`${inputClass} pl-9 pr-12`}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">{t('auth.passwordConfirm')}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.passwordConfirm}
                    onChange={e => set('passwordConfirm', e.target.value)}
                    placeholder={t('auth.passwordConfirmPlaceholder')}
                    className={`w-full bg-gray-50 border rounded-xl pl-9 pr-10 py-3.5 text-sm
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
                  <p className="text-[11px] text-red-500 mt-1 pl-1">{t('auth.passwordMismatch')}</p>
                )}
              </div>

              {/* Code parrain (optionnel) */}
              <div>
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">{t('auth.referralCode')}</label>
                <input
                  type="text"
                  value={form.referralCode}
                  onChange={e => set('referralCode', e.target.value.toUpperCase())}
                  placeholder="Ex: MB3X9K"
                  maxLength={10}
                  className={`${inputClass} font-mono uppercase tracking-wider`}
                />
                <p className="text-[10px] text-gray-400 mt-1 pl-1">{t('auth.referralHint')}</p>
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
                <Button type="submit" loading={loading} disabled={!isStep2Valid}>
                  {t('auth.createAccount')}
                  <ChevronRight size={18} />
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Lien connexion */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            {t('auth.alreadyHaveAccount')}{' '}
            <button onClick={() => navigate('/login')} className="text-brand-600 font-semibold hover:underline">
              {t('auth.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

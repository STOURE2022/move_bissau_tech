import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import Button from '../../components/ui/Button';

const STEPS = ['phone', 'otp', 'newPassword'];

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const country = useCountryConfig();
  const { login } = useAuth();

  const [step, setStep] = useState('phone'); // phone → otp → newPassword
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputs = useRef([]);

  // Formater le numéro
  const formatPhone = (value) => {
    const d = value.replace(/\D/g, '').slice(0, 9);
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`;
    return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  };
  const rawPhone = phone.replace(/\s/g, '');
  const isPhoneValid = /^\d{7,9}$/.test(rawPhone);

  // === Étape 1 : Envoyer OTP ===
  const sendOtp = async () => {
    if (!isPhoneValid) return;
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { phone: `${country.phone_prefix}${rawPhone}` });
      setStep('otp');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // === Étape 2 : OTP ===
  useEffect(() => {
    if (step === 'otp') inputs.current[0]?.focus();
  }, [step]);

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const nd = [...digits];
    nd[index] = value.slice(-1);
    setDigits(nd);
    if (value && index < 5) inputs.current[index + 1]?.focus();
    if (index === 5 && value && nd.join('').length === 6) setStep('newPassword');
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  // === Étape 3 : Nouveau mot de passe ===
  const isPasswordValid = newPassword.length >= 6 && !(/^\d+$/.test(newPassword));
  const isPasswordMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const resetPassword = async () => {
    if (!isPasswordValid || !isPasswordMatch) return;
    setLoading(true); setError('');
    try {
      const fullPhone = `${country.phone_prefix}${rawPhone}`;
      const data = await api.post('/auth/reset-password', {
        phone: fullPhone,
        code: digits.join(''),
        new_password: newPassword,
        new_password_confirm: confirmPassword,
      });
      // Auto-login
      if (data.access) {
        const { setTokens, setUser } = await import('../../api/client').then(m => m.default);
        setTokens?.(data.access, data.refresh);
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // Écran de succès
  if (success) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-white px-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
          <CheckCircle size={80} className="text-brand-500" />
        </motion.div>
        <h2 className="text-2xl font-bold mt-6">Mot de passe modifié !</h2>
        <p className="text-gray-500 mt-2 text-center">Vous pouvez maintenant vous connecter.</p>
      </div>
    );
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="px-5 pt-4 flex items-center justify-between">
        <button onClick={() => step === 'phone' ? navigate('/login') : setStep(STEPS[stepIndex - 1])}
          className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className={`w-8 h-1 rounded-full ${i <= stepIndex ? 'bg-brand-500' : 'bg-gray-200'}`} />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="px-6 pt-8"
      >
        {/* === Étape 1 : Téléphone === */}
        {step === 'phone' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone size={32} className="text-brand-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Mot de passe oublié</h2>
              <p className="text-gray-500 mt-2 text-sm">Entrez votre numéro pour recevoir un code de réinitialisation</p>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3.5">
                <span className="text-lg">{country.country_flag}</span>
                <span className="text-sm font-semibold text-gray-700">{country.phone_prefix}</span>
              </div>
              <input
                type="tel" inputMode="numeric" autoFocus
                value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                placeholder="95 XXX XXXX"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-lg font-medium tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
              />
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}

            <Button onClick={sendOtp} loading={loading} disabled={!isPhoneValid}>
              Envoyer le code
            </Button>
          </>
        )}

        {/* === Étape 2 : Code OTP === */}
        {step === 'otp' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield size={32} className="text-brand-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Code de vérification</h2>
              <p className="text-gray-500 mt-2 text-sm">
                Entrez le code envoyé au <span className="font-semibold text-gray-700">{country.phone_prefix} {phone}</span>
              </p>
            </div>

            <div className="flex gap-3 justify-center mb-6">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => inputs.current[i] = el}
                  type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all
                    ${d ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-gray-50'}
                    focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20`}
                />
              ))}
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}

            <Button onClick={() => setStep('newPassword')} disabled={digits.join('').length !== 6}>
              Continuer
            </Button>
          </>
        )}

        {/* === Étape 3 : Nouveau mot de passe === */}
        {step === 'newPassword' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock size={32} className="text-brand-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Nouveau mot de passe</h2>
              <p className="text-gray-500 mt-2 text-sm">Choisissez un mot de passe sécurisé</p>
            </div>

            <div className="space-y-4 mb-5">
              <div>
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Nouveau mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 6 caractères"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {newPassword.length > 0 && newPassword.length < 6 && (
                  <p className="text-[11px] text-red-500 mt-1 pl-1">Minimum 6 caractères</p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 pl-1 block mb-1">Confirmer</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    className={`w-full bg-gray-50 border rounded-xl pl-9 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 transition-all
                      ${confirmPassword.length > 0
                        ? isPasswordMatch ? 'border-green-300 focus:ring-green-500/20' : 'border-red-300 focus:ring-red-500/20'
                        : 'border-gray-200 focus:ring-brand-500/20'
                      }`}
                  />
                  {confirmPassword.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isPasswordMatch ? <CheckCircle size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertCircle size={16} className="text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </motion.div>
            )}

            <Button onClick={resetPassword} loading={loading} disabled={!isPasswordValid || !isPasswordMatch}>
              Réinitialiser le mot de passe
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import { useTranslation } from '../../i18n/useTranslation';

const RESEND_COOLDOWN = 60; // secondes

export default function OtpPage() {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [shake, setShake] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const inputs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const phone = location.state?.phone || '';
  const { verifyOtp, loading, error, setError, requestOtp } = useAuth();
  const { t } = useTranslation();

  // Focus premier input
  useEffect(() => { inputs.current[0]?.focus(); }, []);

  // Countdown renvoi
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Shake sur erreur
  useEffect(() => {
    if (error) {
      setShake(true);
      navigator.vibrate?.(100);
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (index === 5 && value) {
      const code = newDigits.join('');
      if (code.length === 6) handleVerify(code);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (paste.length === 6) {
      setDigits(paste.split(''));
      handleVerify(paste);
    }
  };

  const handleVerify = async (code) => {
    const result = await verifyOtp(phone, code || digits.join(''));
    if (result) {
      navigator.vibrate?.(20);
      const isNew = result.is_new_user || !result.user.first_name;
      navigate(isNew ? '/complete-profile' : (result.user.role === 'driver' ? '/driver' : '/'));
    } else {
      // Reset les champs sur erreur
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputs.current[0]?.focus(), 100);
    }
  };

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    await requestOtp(phone);
    setResending(false);
    setResendCooldown(RESEND_COOLDOWN);
    setError('');
    setDigits(['', '', '', '', '', '']);
    inputs.current[0]?.focus();
  }, [resendCooldown, phone, requestOtp, setError]);

  // Masquer le numéro partiellement
  const maskedPhone = phone.length > 6
    ? phone.slice(0, 4) + ' ••• ' + phone.slice(-3)
    : phone;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 flex items-center justify-between">
        <button onClick={() => navigate('/login')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={24} className="text-gray-700" />
        </button>
        {/* Indicateur d'étape */}
        <div className="flex gap-1.5">
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className="w-8 h-1 rounded-full bg-brand-500" />
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>
        <div className="w-10" /> {/* spacer */}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col items-center px-6 pt-8"
      >
        {/* Icône */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 12 }}
          className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-6"
        >
          <Shield size={32} className="text-brand-500" />
        </motion.div>

        <h2 className="text-2xl font-bold text-gray-800">{t('auth.verification', 'Vérification')}</h2>
        <p className="text-gray-500 mt-2 text-center text-sm">
          {t('auth.enterCodeSent', 'Entrez le code à 6 chiffres envoyé au')}<br />
          <span className="font-semibold text-gray-700">{maskedPhone}</span>
        </p>

        {/* Champs OTP avec animation shake */}
        <motion.div
          className="flex gap-3 mt-8"
          onPaste={handlePaste}
          animate={shake ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {digits.map((digit, i) => (
            <motion.input
              key={i}
              ref={el => inputs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`w-12 h-14 text-center text-xl font-bold rounded-2xl border-2 outline-none transition-all
                ${error
                  ? 'border-red-400 bg-red-50 text-red-700'
                  : digit
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-gray-50 text-gray-800'
                }
                focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20`}
            />
          ))}
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-500 text-sm mt-4 font-medium"
          >{error}</motion.p>
        )}

        <div className="w-full mt-8">
          <Button
            onClick={() => handleVerify()}
            loading={loading}
            disabled={digits.join('').length !== 6}
          >
            {t('auth.verify', 'Vérifier')}
          </Button>
        </div>

        {/* Renvoi avec countdown */}
        <div className="mt-5 text-center">
          {resendCooldown > 0 ? (
            <p className="text-gray-400 text-sm">
              {t('auth.resendIn', 'Renvoyer dans')} <span className="font-mono font-semibold text-gray-500">{resendCooldown}s</span>
            </p>
          ) : (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={handleResend}
              disabled={resending}
              className="flex items-center gap-2 mx-auto text-brand-500 text-sm font-semibold hover:text-brand-600 transition"
            >
              <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
              {t('auth.resendCode', 'Renvoyer le code')}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

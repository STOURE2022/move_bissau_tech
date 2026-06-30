import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Banknote, Smartphone, ArrowLeft, CheckCircle, Star, ChevronRight } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import RideReceipt from '../../components/ui/RideReceipt';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../i18n/useTranslation';

export default function PaymentPage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [ride, setRide] = useState(null);
  const [method, setMethod] = useState(() => localStorage.getItem('mb_pay_method') || 'cash');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('pay'); // 'pay' | 'receipt'

  const methods = [
    { id: 'cash', label: t('payment.cash'), desc: t('payment.cashDesc'), icon: '💵', color: 'bg-green-50 border-green-200' },
    { id: 'orange_money', label: t('payment.orangeMoney'), desc: t('payment.orangeDesc'), icon: '🟠', color: 'bg-orange-50 border-orange-200' },
    { id: 'moov_money', label: t('payment.moovMoney'), desc: t('payment.moovDesc'), icon: '🔵', color: 'bg-blue-50 border-blue-200' },
  ];

  // Code promo
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    api.get(`/rides/${rideId}`).then(setRide).catch(() => {});
    if (user?.phone) setPhone(user.phone);
  }, []);

  const pay = async () => {
    setLoading(true);
    try {
      if (method === 'cash') {
        setStep('receipt');
      } else {
        await api.post('/payments/initiate', {
          ride_id: rideId,
          payment_method: method,
          phone,
        });
        const updated = await api.get(`/rides/${rideId}`);
        setRide(updated);
        setStep('receipt');
      }
    } catch (e) {
      toast.show(e.message || t('common.error'), 'error');
      setLoading(false);
    }
  };

  // === Écran reçu ===
  if (step === 'receipt') {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
          {/* Animation succès */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10 }}
            className="mb-6"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle size={44} className="text-green-500" />
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl font-bold text-gray-800 mb-1"
          >
            {method === 'cash' ? t('payment.payDriver') : `${t('payment.paymentInitiated')}`}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-gray-500 mb-6 text-center"
          >
            {method === 'cash'
              ? t('payment.payDriverSub')
              : t('payment.confirmOnPhone')
            }
          </motion.p>

          {/* Reçu */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full"
          >
            <RideReceipt ride={ride} showActions={false} />
          </motion.div>
        </div>

        {/* CTA en bas */}
        <div className="px-5 pb-8 space-y-3">
          <Button onClick={() => navigate(`/rate/${rideId}`)}>
            <Star size={18} />
            {t('tracking.rateDriver')}
          </Button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 text-gray-400 text-sm font-medium hover:text-gray-600 transition"
          >
            {t('payment.skipAndHome')}
          </button>
        </div>
      </div>
    );
  }

  // === Écran paiement ===
  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h2 className="text-lg font-bold">{t('payment.title')}</h2>
      </div>

      <div className="px-5 pb-10">
        {/* Montant */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-50 rounded-3xl p-6 text-center mb-6"
        >
          <p className="text-sm text-brand-600">{t('payment.amountToPay')}</p>
          <p className="text-4xl font-extrabold text-brand-700 mt-1">
            {ride?.agreed_price || '—'} <span className="text-lg">{t('common.fcfa')}</span>
          </p>
          <p className="text-xs text-brand-500 mt-1">
            {ride?.pickup_address} → {ride?.dropoff_address}
          </p>
        </motion.div>

        {/* Code promo */}
        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">{t('payment.promoCode')}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); setPromoResult(null); }}
              placeholder={t('payment.promoPlaceholder')}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono uppercase tracking-wider
                         focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            />
            <motion.button
              whileTap={{ scale: 0.95 }}
              disabled={promoLoading || !promoCode.trim()}
              onClick={async () => {
                setPromoLoading(true); setPromoError('');
                try {
                  const res = await api.post('/auth/promo/validate', {
                    code: promoCode.trim(),
                    ride_price: ride?.agreed_price || 0,
                  });
                  setPromoResult(res);
                } catch (e) {
                  setPromoError(e.message || t('payment.promoInvalid'));
                  setPromoResult(null);
                }
                setPromoLoading(false);
              }}
              className="px-5 py-3 bg-brand-500 text-white font-semibold rounded-xl text-sm hover:bg-brand-600 transition disabled:opacity-40"
            >
              {promoLoading ? '...' : t('payment.promoApply')}
            </motion.button>
          </div>
          {promoError && <p className="text-xs text-red-500 mt-1.5">{promoError}</p>}
          {promoResult?.valid && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mt-2"
            >
              <span className="text-green-600 text-sm">🎉</span>
              <p className="text-xs text-green-700 font-medium">
                -{promoResult.discount_amount} F {t('payment.promoApplied')} <span className="font-bold">{promoResult.new_price} F</span>
              </p>
            </motion.div>
          )}
        </div>

        {/* Choix méthode */}
        <p className="text-sm font-semibold text-gray-700 mb-3">{t('payment.paymentMethod')}</p>
        <div className="space-y-2 mb-6">
          {methods.map((m, i) => (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              onClick={() => { setMethod(m.id); localStorage.setItem('mb_pay_method', m.id); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                method === m.id
                  ? `${m.color} shadow-sm`
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-500">{m.desc}</p>
              </div>
              {method === m.id && (
                <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {/* Téléphone pour mobile money */}
        {method !== 'cash' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6"
          >
            <Input
              label={t('payment.phoneNumber')}
              icon={Smartphone}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+245 95 XXX XXXX"
            />
          </motion.div>
        )}

        <Button
          onClick={pay}
          loading={loading}
          disabled={method !== 'cash' && phone.length < 8}
        >
          {method === 'cash'
            ? `${t('payment.payCash')} — ${ride?.agreed_price || 0} F`
            : `${t('payment.payVia')} ${methods.find(m => m.id === method)?.label}`
          }
        </Button>
      </div>
    </div>
  );
}

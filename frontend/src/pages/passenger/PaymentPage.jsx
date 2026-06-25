import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Banknote, Smartphone, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../hooks/useAuth';

const methods = [
  { id: 'cash', label: 'Espèces', desc: 'Payez directement au chauffeur', icon: '💵', color: 'bg-green-50 border-green-200' },
  { id: 'orange_money', label: 'Orange Money', desc: 'Via votre compte Orange', icon: '🟠', color: 'bg-orange-50 border-orange-200' },
  { id: 'moov_money', label: 'Moov Money', desc: 'Via votre compte Moov', icon: '🔵', color: 'bg-blue-50 border-blue-200' },
];

export default function PaymentPage() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [ride, setRide] = useState(null);
  const [method, setMethod] = useState(() => localStorage.getItem('mb_pay_method') || 'cash');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get(`/rides/${rideId}`).then(setRide).catch(() => {});
    // Pré-remplir le téléphone depuis le profil
    if (user?.phone) setPhone(user.phone);
  }, []);

  const pay = async () => {
    setLoading(true);
    try {
      if (method === 'cash') {
        // Le chauffeur confirme côté chauffeur
        setSuccess(true);
        setTimeout(() => navigate(`/rate/${rideId}`), 2000);
      } else {
        await api.post('/payments/initiate', {
          ride_id: rideId,
          payment_method: method,
          phone,
        });
        setSuccess(true);
        setTimeout(() => navigate(`/rate/${rideId}`), 2000);
      }
    } catch (e) {
      toast.show(e.message || 'Erreur de paiement', 'error');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-white px-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10 }}
        >
          <CheckCircle size={80} className="text-brand-500 mx-auto" />
        </motion.div>
        <h2 className="text-2xl font-bold mt-6">
          {method === 'cash' ? 'Payez le chauffeur' : 'Paiement initié !'}
        </h2>
        <p className="text-gray-500 mt-2 text-center">
          {method === 'cash'
            ? 'Remettez le montant en espèces à votre chauffeur'
            : 'Confirmez le paiement sur votre téléphone'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <h2 className="text-lg font-bold">Paiement</h2>
      </div>

      <div className="px-5 pb-10">
        {/* Montant */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand-50 rounded-3xl p-6 text-center mb-6"
        >
          <p className="text-sm text-brand-600">Montant à payer</p>
          <p className="text-4xl font-extrabold text-brand-700 mt-1">
            {ride?.agreed_price || '—'} <span className="text-lg">F CFA</span>
          </p>
          <p className="text-xs text-brand-500 mt-1">
            {ride?.pickup_address} → {ride?.dropoff_address}
          </p>
        </motion.div>

        {/* Choix méthode */}
        <p className="text-sm font-semibold text-gray-700 mb-3">Mode de paiement</p>
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
              label="Numéro de téléphone"
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
            ? `Payer en espèces — ${ride?.agreed_price || 0} F`
            : `Payer via ${methods.find(m => m.id === method)?.label}`
          }
        </Button>
      </div>
    </div>
  );
}

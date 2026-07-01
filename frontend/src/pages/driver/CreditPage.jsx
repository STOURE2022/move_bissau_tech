import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, Send, Clock, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
import DriverNav from '../../components/layout/DriverNav';
import { useTranslation } from '../../i18n/useTranslation';

export default function CreditPage() {
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [credit, setCredit] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [showTopup, setShowTopup] = useState(false);
  const [topupAmount, setTopupAmount] = useState('5000');
  const [topupMethod, setTopupMethod] = useState('orange_money');
  const [topupPhone, setTopupPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Retrait
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('orange_money');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  const toast = useToast();

  useEffect(() => {
    loadCredit();
    loadTransactions();
    loadWithdrawals();
  }, []);

  const loadCredit = async () => {
    try { setCredit(await api.get('/commissions/balance')); } catch {}
  };

  const loadTransactions = async () => {
    try { setTransactions(await api.get('/commissions/transactions')); } catch {}
  };

  const doTopup = async () => {
    setLoading(true);
    try {
      await api.post('/commissions/topup', {
        amount: parseInt(topupAmount),
        payment_method: topupMethod,
        phone: topupPhone,
      });
      setShowTopup(false);
      loadCredit();
      loadTransactions();
    } catch (e) { toast.show(e.message, 'error'); }
    setLoading(false);
  };

  const loadWithdrawals = async () => {
    try { setWithdrawals(await api.get('/commissions/withdrawals')); } catch {}
  };

  const doWithdraw = async () => {
    setWithdrawLoading(true);
    try {
      await api.post('/commissions/withdraw', {
        amount: parseInt(withdrawAmount),
        withdrawal_method: withdrawMethod,
        phone: withdrawPhone,
      });
      toast.show(t('driver.withdrawRequestSent', 'Demande de retrait envoyée !'), 'success');
      setShowWithdraw(false);
      setWithdrawAmount('');
      loadCredit();
      loadTransactions();
      loadWithdrawals();
    } catch (e) { toast.show(e.message, 'error'); }
    setWithdrawLoading(false);
  };

  const minCredit = 200;
  const availableForWithdraw = Math.max(0, (credit?.balance || 0) - minCredit);

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* Header solde */}
      <div className="bg-brand-500 px-5 pt-5 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-white/10">
            <ArrowLeft size={22} className="text-white" />
          </button>
          <h2 className="text-lg font-bold text-white">{t('driver.creditTitle', 'Crédit commission')}</h2>
        </div>

        <div className="text-center text-white">
          <p className="text-brand-200 text-sm">{t('driver.currentBalance', 'Solde actuel')}</p>
          <motion.p
            key={credit?.balance}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-4xl font-extrabold mt-1"
          >
            {credit?.balance || 0} <span className="text-xl">{t('common.fcfa', 'F CFA')}</span>
          </motion.p>
        </div>

        <div className="flex justify-center mt-4 gap-3">
          <Button
            variant="gold"
            size="md"
            icon={Plus}
            onClick={() => setShowTopup(true)}
          >
            {t('driver.recharge', 'Recharger')}
          </Button>
          {availableForWithdraw > 0 && (
            <Button
              variant="secondary"
              size="md"
              icon={Send}
              onClick={() => setShowWithdraw(true)}
              className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30"
            >
              {t('driver.withdraw', 'Retirer')}
            </Button>
          )}
        </div>
      </div>

      <div className="px-5 -mt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-soft text-center">
            <p className="text-xs text-gray-400">{t('driver.totalRecharged', 'Total rechargé')}</p>
            <p className="font-bold text-green-600">{credit?.total_topups || 0} F</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-soft text-center">
            <p className="text-xs text-gray-400">{t('driver.commissionsPaid', 'Commissions payées')}</p>
            <p className="font-bold text-orange-600">{credit?.total_commissions || 0} F</p>
          </div>
        </div>

        {/* Historique */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-3">{t('common.history', 'Historique')}</h3>
          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-soft text-center">
              <p className="text-gray-400 text-sm">{t('driver.noTransaction', 'Aucune transaction')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-soft overflow-hidden divide-y divide-gray-50">
              {transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-4"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tx.amount > 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {tx.amount > 0
                      ? <ArrowUpCircle size={18} className="text-green-500" />
                      : <ArrowDownCircle size={18} className="text-red-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString(lang)} · {new Date(tx.created_at).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} F
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section retraits */}
      {withdrawals.length > 0 && (
        <div className="px-5 mt-4">
          <h3 className="font-semibold text-gray-700 mb-3">{t('driver.myWithdrawals', 'Mes retraits')}</h3>
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden divide-y divide-gray-50">
            {withdrawals.map((w) => {
              const statusConfig = {
                pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50', label: t('driver.withdrawPending', 'En attente') },
                approved: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50', label: t('driver.withdrawApproved', 'Approuvé') },
                processing: { icon: RefreshCw, color: 'text-blue-500', bg: 'bg-blue-50', label: t('driver.withdrawProcessing', 'En cours') },
                completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', label: t('driver.withdrawCompleted', 'Effectué') },
                rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: t('driver.withdrawRejected', 'Rejeté') },
              };
              const sc = statusConfig[w.status] || statusConfig.pending;
              return (
                <div key={w.id} className="flex items-center gap-3 p-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sc.bg}`}>
                    <sc.icon size={18} className={sc.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {w.reference} → {w.phone}
                    </p>
                    <p className="text-xs text-gray-400">
                      {sc.label} · {new Date(w.created_at).toLocaleDateString(lang)}
                    </p>
                    {w.admin_note && w.status === 'rejected' && (
                      <p className="text-xs text-red-500 mt-0.5">{w.admin_note}</p>
                    )}
                  </div>
                  <p className="font-bold text-sm text-gray-800">{w.amount} F</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal retrait */}
      <AnimatePresence>
        {showWithdraw && (
          <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowWithdraw(false)} />
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white rounded-t-3xl z-50 px-6 pt-6 pb-10"
            >
              <div className="flex justify-center mb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">{t('driver.withdrawMyMoney', 'Retirer mon argent')}</h3>
              <p className="text-center text-sm text-gray-500 mb-5">
                {t('driver.available', 'Disponible')} : <span className="font-bold text-brand-600">{availableForWithdraw} {t('common.fcfa', 'F CFA')}</span>
              </p>

              <Input
                label={t('driver.amountToWithdraw', 'Montant à retirer')}
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder={`Max ${availableForWithdraw} F`}
                className="text-center text-xl font-bold"
              />

              <div className="flex gap-2 my-4">
                {[
                  { id: 'orange_money', label: 'Orange Money', emoji: '🟠' },
                  { id: 'moov_money', label: 'Moov Money', emoji: '🔵' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setWithdrawMethod(m.id)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      withdrawMethod === m.id
                        ? 'bg-brand-50 border-2 border-brand-500 text-brand-700'
                        : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                    }`}
                  >
                    <span>{m.emoji}</span> {m.label}
                  </button>
                ))}
              </div>

              <Input
                label={t('driver.receptionNumber', 'Numéro de réception')}
                icon={Smartphone}
                type="tel"
                value={withdrawPhone}
                onChange={e => setWithdrawPhone(e.target.value)}
                placeholder="+245 95 XXX XXXX"
              />

              <div className="mt-5">
                <Button
                  onClick={doWithdraw}
                  loading={withdrawLoading}
                  disabled={!withdrawAmount || !withdrawPhone || parseInt(withdrawAmount) > availableForWithdraw || parseInt(withdrawAmount) <= 0}
                >
                  {t('driver.requestWithdrawal', 'Demander le retrait')} — {withdrawAmount || 0} F
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-3">
                {t('driver.withdrawAdminApproval', "Le retrait sera traité après approbation par l'admin")}
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal rechargement */}
      {showTopup && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowTopup(false)} />
          <motion.div
            initial={{ y: 300 }}
            animate={{ y: 0 }}
            className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white rounded-t-3xl z-50 px-6 pt-6 pb-10"
          >
            <div className="flex justify-center mb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <h3 className="text-xl font-bold text-center mb-5">{t('driver.recharge', 'Recharger')}</h3>

            {/* Montants rapides */}
            <div className="flex gap-2 mb-4">
              {[1000, 2000, 5000, 10000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(String(amt))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    topupAmount === String(amt)
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {amt} F
                </button>
              ))}
            </div>

            <Input
              label={t('driver.customAmount', 'Montant personnalisé')}
              type="number"
              value={topupAmount}
              onChange={e => setTopupAmount(e.target.value)}
              className="text-center text-xl font-bold"
            />

            <div className="flex gap-2 my-4">
              {[
                { id: 'orange_money', label: 'Orange Money', emoji: '🟠' },
                { id: 'moov_money', label: 'Moov Money', emoji: '🔵' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setTopupMethod(m.id)}
                  className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                    topupMethod === m.id
                      ? 'bg-brand-50 border-2 border-brand-500 text-brand-700'
                      : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                  }`}
                >
                  <span>{m.emoji}</span> {m.label}
                </button>
              ))}
            </div>

            <Input
              label={t('auth.phone', 'Numéro de téléphone')}
              type="tel"
              value={topupPhone}
              onChange={e => setTopupPhone(e.target.value)}
              placeholder="+245 95 XXX XXXX"
            />

            <div className="mt-5">
              <Button onClick={doTopup} loading={loading} disabled={!topupAmount || !topupPhone}>
                {t('driver.recharge', 'Recharger')} {topupAmount} {t('common.fcfa', 'F CFA')}
              </Button>
            </div>
          </motion.div>
        </>
      )}

      <DriverNav />
    </div>
  );
}

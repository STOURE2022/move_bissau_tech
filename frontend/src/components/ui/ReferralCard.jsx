import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gift, Copy, Share2, CheckCircle } from 'lucide-react';
import api from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

export default function ReferralCard() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    api.get('/auth/referral/code').then(setData).catch(() => {});
    api.get('/auth/referral/stats').then(setStats).catch(() => {});
  }, []);

  if (!data) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(data.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: 'MoveBissau', text: data.share_text });
    } else {
      copyCode();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-brand-500 to-emerald-600 rounded-3xl p-5 text-white shadow-lg"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
          <Gift size={20} />
        </div>
        <div>
          <h3 className="font-bold">{t('profilePage.referral')}</h3>
          <p className="text-white/70 text-xs">{t('profilePage.referralSub')}</p>
        </div>
      </div>
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4">
        <p className="text-xs text-white/60 mb-1">{t('profilePage.yourCode')}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black tracking-widest">{data.referral_code}</span>
          <button onClick={copyCode} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition">
            {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>
      {stats && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-lg font-bold">{stats.total_referrals}</p>
            <p className="text-[10px] text-white/60">{t('profilePage.invited')}</p>
          </div>
          <div className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-center">
            <p className="text-lg font-bold">{stats.total_bonus} F</p>
            <p className="text-[10px] text-white/60">{t('profilePage.bonusEarned')}</p>
          </div>
        </div>
      )}
      <motion.button whileTap={{ scale: 0.97 }} onClick={share}
        className="w-full bg-white text-brand-600 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-sm"
      >
        <Share2 size={16} />
        {t('profilePage.shareCode')}
      </motion.button>
    </motion.div>
  );
}

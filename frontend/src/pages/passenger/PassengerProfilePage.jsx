import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Phone, Globe, LogOut, Camera, User, Edit3, Check, X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import ReferralCard from '../../components/ui/ReferralCard';
import EmergencyContacts from '../../components/ui/EmergencyContacts';
import api from '../../api/client';
import { useTranslation } from '../../i18n/useTranslation';

export default function PassengerProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { t } = useTranslation();

  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [saving, setSaving] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  const changeLang = async (newLang) => {
    try {
      await api.patch('/auth/users/me/language', { preferred_lang: newLang });
      localStorage.setItem('mb_lang', newLang);
      refreshUser();
      window.location.reload();
    } catch {}
  };

  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      await api.patch('/auth/users/me', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      refreshUser();
      setEditing(false);
      toast.show(t('passenger.profileUpdated', 'Profil mis à jour'), 'success');
    } catch (e) {
      toast.show(e.message || t('common.error', 'Erreur'), 'error');
    }
    setSaving(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mb_access')}` },
        body: formData,
      });
      if (res.ok) {
        refreshUser();
        toast.show(t('passenger.photoUpdated', 'Photo mise à jour'), 'success');
      }
    } catch {}
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-500 to-brand-600 px-5 pt-5 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-white/10">
            <ArrowLeft size={22} className="text-white" />
          </button>
          <h2 className="text-lg font-bold text-white">{t('common.profile', 'Mon profil')}</h2>
        </div>

        {/* Avatar + nom */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center border-2 border-white/30 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-white/80">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center border-2 border-brand-500 cursor-pointer shadow-sm">
              <Camera size={12} className="text-brand-500" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          <div>
            <h3 className="text-white text-xl font-bold">{user?.first_name} {user?.last_name}</h3>
            <p className="text-brand-200 text-sm">{user?.phone}</p>
            <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
              {t('auth.passenger', 'Passager')}
            </span>
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="px-5 -mt-4 space-y-4">

        {/* Infos personnelles */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-soft overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <p className="text-sm font-semibold text-gray-800">{t('passenger.information', 'Informations')}</p>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs text-brand-500 font-semibold"
              >
                <Edit3 size={12} /> {t('profilePage.editName', 'Modifier')}
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="p-1.5 bg-brand-500 text-white rounded-lg"
                >
                  {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                </button>
                <button
                  onClick={() => { setEditing(false); setFirstName(user?.first_name || ''); setLastName(user?.last_name || ''); }}
                  className="p-1.5 bg-gray-100 text-gray-500 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-50">
            {/* Prénom */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                <User size={16} className="text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('auth.firstName', 'Prénom')}</p>
                {editing ? (
                  <input
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="text-sm font-medium text-gray-800 outline-none border-b border-brand-500 w-full py-0.5"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-800">{user?.first_name || '—'}</p>
                )}
              </div>
            </div>

            {/* Nom */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                <User size={16} className="text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('auth.lastName', 'Nom')}</p>
                {editing ? (
                  <input
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="text-sm font-medium text-gray-800 outline-none border-b border-brand-500 w-full py-0.5"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-800">{user?.last_name || '—'}</p>
                )}
              </div>
            </div>

            {/* Téléphone */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                <Phone size={16} className="text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('profilePage.phone', 'Téléphone')}</p>
                <p className="text-sm font-medium text-gray-800">{user?.phone}</p>
              </div>
            </div>

            {/* Langue */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                <Globe size={16} className="text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-400">{t('profilePage.language', 'Langue')}</p>
                <p className="text-sm font-medium text-gray-800">
                  {user?.preferred_lang === 'pt' ? 'Português' : 'Français'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Changer la langue */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-soft p-4"
        >
          <p className="text-xs text-gray-400 mb-2">{t('profilePage.changeLang', 'Changer la langue')}</p>
          <div className="flex gap-2">
            {[
              { code: 'fr', label: 'Français', flag: '🇫🇷' },
              { code: 'pt', label: 'Português', flag: '🇵🇹' },
            ].map(l => (
              <button
                key={l.code}
                onClick={() => changeLang(l.code)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                  user?.preferred_lang === l.code
                    ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{l.flag}</span> {l.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Contacts d'urgence */}
        <EmergencyContacts />

        {/* Parrainage */}
        <ReferralCard />

        {/* Déconnexion */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={handleLogout}
          className="w-full bg-white rounded-2xl shadow-soft p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition"
        >
          <LogOut size={20} />
          <span className="font-semibold">{t('common.logout', 'Déconnexion')}</span>
        </motion.button>

        <div className="h-6" />
      </div>
    </div>
  );
}

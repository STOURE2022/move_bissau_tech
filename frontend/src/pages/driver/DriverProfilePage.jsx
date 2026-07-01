import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Star, Car, Shield, Phone, Globe, FileText,
  ChevronRight, LogOut, CheckCircle, Clock, AlertTriangle, Camera
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import DriverNav from '../../components/layout/DriverNav';
import { useTranslation } from '../../i18n/useTranslation';

export default function DriverProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const [profile, setProfile] = useState(null);
  const [credit, setCredit] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [activeTab, setActiveTab] = useState('info'); // info | vehicle | docs | ratings
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [profileData, creditData, ratingsData] = await Promise.all([
        api.get('/drivers/me'),
        api.get('/commissions/balance'),
        api.get('/ratings/my-ratings').catch(() => []),
      ]);
      setProfile(profileData);
      setCredit(creditData);
      setRatings(ratingsData);
    } catch {}
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  const changeLang = async (newLang) => {
    await api.patch('/auth/users/me/language', { preferred_lang: newLang });
    localStorage.setItem('mb_lang', newLang);
    refreshUser();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const verificationIcon = {
    approved: <CheckCircle size={14} className="text-green-500" />,
    pending: <Clock size={14} className="text-yellow-500" />,
    rejected: <AlertTriangle size={14} className="text-red-500" />,
  };

  const verificationLabel = {
    approved: t('driver.verified', 'Vérifié'),
    pending: t('driver.pendingVerification', 'En attente'),
    rejected: t('driver.rejected', 'Rejeté'),
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-20">
      {/* Header profil */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 px-5 pt-5 pb-8">
        <button onClick={() => navigate(-1)} className="p-1.5 -ml-2 rounded-xl hover:bg-white/10 mb-3">
          <ArrowLeft size={22} className="text-white" />
        </button>
        {/* Avatar + infos */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-brand-500/20 rounded-3xl flex items-center justify-center border-2 border-brand-500/30 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-brand-400">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/driver/setup')}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-500 rounded-full flex items-center justify-center border-2 border-gray-900"
            >
              <Camera size={12} className="text-white" />
            </button>
          </div>
          <div className="flex-1">
            <h2 className="text-white text-xl font-bold">{user?.first_name} {user?.last_name}</h2>
            <p className="text-gray-400 text-sm">{user?.phone}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {verificationIcon[profile?.verification_status]}
              <span className={`text-xs font-medium ${
                profile?.verification_status === 'approved' ? 'text-green-400' :
                profile?.verification_status === 'pending' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {verificationLabel[profile?.verification_status]}
              </span>
            </div>
          </div>
        </div>

        {/* Stats résumé */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: profile ? Number(profile.average_rating).toFixed(1) : '—', label: t('driver.ratingLabel', 'Note'), icon: '⭐' },
            { value: profile?.total_rides || 0, label: t('driver.ridesCount', 'Courses'), icon: '🏍️' },
            { value: `${credit?.balance || 0}`, label: t('driver.creditF', 'Crédit F'), icon: '💰' },
            { value: `${profile?.acceptance_rate ? Number(profile.acceptance_rate).toFixed(0) : 0}%`, label: t('driver.acceptance', 'Accept.'), icon: '✅' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white/10 rounded-xl p-2 text-center"
            >
              <span className="text-sm">{s.icon}</span>
              <p className="text-white font-bold text-sm">{s.value}</p>
              <p className="text-white/40 text-[9px]">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bannière vérification */}
      {profile && profile.verification_status !== 'approved' && (
        <div className="px-5 -mt-3 mb-3">
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/driver/setup')}
            className={`w-full rounded-2xl p-4 flex items-center gap-3 text-left shadow-soft ${
              profile.verification_status === 'rejected'
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              profile.verification_status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              {profile.verification_status === 'rejected'
                ? <AlertTriangle size={20} className="text-red-600" />
                : <Clock size={20} className="text-yellow-600" />
              }
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-sm ${
                profile.verification_status === 'rejected' ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {profile.verification_status === 'rejected'
                  ? t('driver.dossierRejected', 'Dossier rejeté — corrigez vos documents')
                  : t('driver.dossierPending', 'Dossier en attente de validation')
                }
              </p>
              <p className={`text-xs mt-0.5 ${
                profile.verification_status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {profile.verification_status === 'rejected'
                  ? t('driver.clickToResubmit', 'Cliquez pour resoumettre')
                  : t('driver.completeDossier', 'Complétez votre dossier pour commencer')
                }
              </p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </motion.button>
        </div>
      )}

      {/* Onglets */}
      <div className="px-5">
        <div className="bg-white rounded-2xl shadow-soft p-1 flex gap-1 mb-5">
          {[
            { id: 'info', label: t('driver.tabInfo', 'Infos') },
            { id: 'vehicle', label: t('driver.tabVehicle', 'Véhicule') },
            { id: 'docs', label: t('driver.tabDocs', 'Documents') },
            { id: 'ratings', label: t('driver.tabRatings', 'Avis') },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu des onglets */}
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

          {/* === Infos personnelles === */}
          {activeTab === 'info' && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl shadow-soft overflow-hidden divide-y divide-gray-50">
                {[
                  { icon: Phone, label: t('profilePage.phone', 'Téléphone'), value: user?.phone },
                  { icon: Globe, label: t('profilePage.language', 'Langue'), value: user?.preferred_lang === 'pt' ? 'Português' : 'Français' },
                  { icon: Car, label: t('driver.vehicleType', 'Type véhicule'), value: profile?.vehicle_type === 'moto' ? '🏍️ Moto-taxi' : '🚗 Voiture' },
                  { icon: Shield, label: t('driver.status', 'Statut'), value: verificationLabel[profile?.verification_status] },
                  { icon: FileText, label: t('driver.license', 'Permis'), value: profile?.license_number || t('driver.notProvided', 'Non renseigné') },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center">
                      <item.icon size={16} className="text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className="text-sm font-medium text-gray-800">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Changer la langue */}
              <div className="bg-white rounded-2xl shadow-soft p-4">
                <p className="text-xs text-gray-400 mb-2">{t('profilePage.changeLang', 'Changer la langue')}</p>
                <div className="flex gap-2">
                  {[
                    { code: 'fr', label: 'Français', flag: '🇫🇷' },
                    { code: 'pt', label: 'Português', flag: '🇵🇹' },
                  ].map(l => (
                    <button
                      key={l.code}
                      onClick={() => changeLang(l.code)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
                        user?.preferred_lang === l.code
                          ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <span>{l.flag}</span> {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Déconnexion */}
              <button
                onClick={handleLogout}
                className="w-full bg-white rounded-2xl shadow-soft p-4 flex items-center gap-3 text-red-500 hover:bg-red-50 transition"
              >
                <LogOut size={20} />
                <span className="font-semibold">{t('common.logout', 'Déconnexion')}</span>
              </button>
            </div>
          )}

          {/* === Véhicule === */}
          {activeTab === 'vehicle' && (
            <div className="space-y-3">
              {profile?.vehicles?.length > 0 ? profile.vehicles.map(v => (
                <div key={v.id} className="bg-white rounded-2xl shadow-soft p-5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-3xl">
                      {v.vehicle_type === 'moto' ? '🏍️' : '🚗'}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{v.brand} {v.model}</p>
                      <p className="text-gray-500 text-sm">{v.color} · {v.year || ''}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{t('driver.registration', 'Immatriculation')}</span>
                    <span className="font-mono font-bold text-gray-800 text-lg tracking-wider">{v.plate_number}</span>
                  </div>
                </div>
              )) : (
                <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
                  <Car size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">{t('driver.noVehicle', 'Aucun véhicule enregistré')}</p>
                </div>
              )}
            </div>
          )}

          {/* === Documents === */}
          {activeTab === 'docs' && (
            <div className="space-y-3">
              {profile?.documents?.length > 0 ? profile.documents.map(doc => (
                <div key={doc.id} className="bg-white rounded-2xl shadow-soft p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    doc.status === 'approved' ? 'bg-green-50' :
                    doc.status === 'pending' ? 'bg-yellow-50' : 'bg-red-50'
                  }`}>
                    <FileText size={18} className={
                      doc.status === 'approved' ? 'text-green-500' :
                      doc.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                    } />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 text-sm">{doc.doc_type}</p>
                    <p className="text-xs text-gray-400">
                      {doc.status === 'approved' ? t('driver.docApproved', 'Approuvé') :
                       doc.status === 'pending' ? t('driver.docPendingReview', 'En cours de vérification') : t('driver.docRejected', 'Rejeté')}
                    </p>
                    {doc.rejection_reason && (
                      <p className="text-xs text-red-500 mt-0.5">{doc.rejection_reason}</p>
                    )}
                  </div>
                  {doc.status === 'approved' ? (
                    <CheckCircle size={18} className="text-green-500" />
                  ) : doc.status === 'pending' ? (
                    <Clock size={18} className="text-yellow-500" />
                  ) : (
                    <AlertTriangle size={18} className="text-red-500" />
                  )}
                </div>
              )) : (
                <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
                  <FileText size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-1">{t('driver.noDocSubmitted', 'Aucun document soumis')}</p>
                  <p className="text-gray-400 text-xs">{t('driver.submitDocsToVerify', 'Soumettez vos documents pour être vérifié')}</p>
                </div>
              )}

              {/* Documents requis */}
              <div className="bg-brand-50 rounded-2xl p-4">
                <p className="text-xs font-semibold text-brand-700 mb-2">{t('driver.requiredDocs', 'Documents requis')}</p>
                <div className="space-y-1.5">
                  {[
                    t('driver.docIdentity', "Pièce d'identité"),
                    t('driver.docLicense', 'Permis de conduire'),
                    t('driver.docInsurance', 'Assurance'),
                    t('driver.docCriminalRecord', 'Casier judiciaire'),
                    t('driver.docRegistration', 'Carte grise'),
                  ].map(d => (
                    <p key={d} className="text-xs text-brand-600 flex items-center gap-2">
                      <span className="w-1 h-1 bg-brand-500 rounded-full" /> {d}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === Avis reçus === */}
          {activeTab === 'ratings' && (
            <div className="space-y-3">
              {/* Résumé note */}
              <div className="bg-white rounded-2xl shadow-soft p-5 text-center">
                <p className="text-4xl font-extrabold text-gray-800">
                  {profile ? Number(profile.average_rating).toFixed(1) : '—'}
                </p>
                <div className="flex justify-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={18}
                      className={i <= Math.round(profile?.average_rating || 0) ? 'text-gold fill-gold' : 'text-gray-300'}
                      fill={i <= Math.round(profile?.average_rating || 0) ? '#FFCD00' : 'none'}
                    />
                  ))}
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  {profile?.total_rides || 0} {t('driver.ridesCount', 'courses')} · {ratings.length} {t('driver.reviews', 'avis')}
                </p>
              </div>

              {/* Liste des avis */}
              {ratings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-soft p-8 text-center">
                  <Star size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">{t('driver.noReviews', 'Aucun avis pour le moment')}</p>
                  <p className="text-gray-400 text-xs mt-1">{t('driver.reviewsWillAppear', 'Les avis apparaîtront après vos courses')}</p>
                </div>
              ) : (
                ratings.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-2xl shadow-soft p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{r.from_user_name}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={12}
                            className={s <= r.score ? 'text-gold fill-gold' : 'text-gray-300'}
                            fill={s <= r.score ? '#FFCD00' : 'none'}
                          />
                        ))}
                      </div>
                    </div>
                    {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
                    <p className="text-[10px] text-gray-400 mt-2">
                      {new Date(r.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'long' })}
                    </p>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </div>

      <DriverNav />
    </div>
  );
}

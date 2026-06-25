import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera, Car, FileText, ChevronRight, ChevronLeft, Check,
  Upload, X, AlertCircle, Shield, User
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const STEPS = [
  { id: 'photo', title: 'Photo de profil', icon: Camera, desc: 'Ajoutez une photo claire de vous' },
  { id: 'vehicle', title: 'Votre véhicule', icon: Car, desc: 'Informations sur votre véhicule' },
  { id: 'docs', title: 'Documents', icon: FileText, desc: 'Pièces justificatives requises' },
  { id: 'submit', title: 'Validation', icon: Shield, desc: 'Soumettre votre dossier' },
];

const DOC_TYPES = [
  { id: 'identity', label: "Pièce d'identité", icon: '🪪', required: true, desc: 'BI, passeport ou carte consulaire' },
  { id: 'license', label: 'Permis de conduire', icon: '🪪', required: true, desc: 'Permis valide catégorie A ou B' },
  { id: 'insurance', label: 'Assurance', icon: '🛡️', required: true, desc: 'Assurance responsabilité civile' },
  { id: 'vehicle_registration', label: 'Carte grise', icon: '📄', required: true, desc: 'Carte grise du véhicule' },
  { id: 'criminal_record', label: 'Casier judiciaire', icon: '📋', required: true, desc: 'Extrait de casier (< 3 mois)' },
];

export default function DriverSetupPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Photo
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  const avatarRef = useRef(null);

  // Véhicule
  const [vehicleType, setVehicleType] = useState('moto');
  const [vehicleForm, setVehicleForm] = useState({
    brand: '', model: '', color: '', plate_number: '', year: '',
  });
  const [licenseNumber, setLicenseNumber] = useState('');

  // Documents
  const [documents, setDocuments] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const fileRef = useRef(null);

  // Charger les données existantes
  useEffect(() => {
    loadExisting();
  }, []);

  const loadExisting = async () => {
    try {
      const profile = await api.get('/drivers/me');
      setVehicleType(profile.vehicle_type);
      if (profile.license_number) setLicenseNumber(profile.license_number);
      if (profile.vehicles?.length > 0) {
        const v = profile.vehicles[0];
        setVehicleForm({ brand: v.brand || '', model: v.model || '', color: v.color || '', plate_number: v.plate_number || '', year: v.year?.toString() || '' });
      }
      // Charger documents existants
      const docs = await api.get('/drivers/documents');
      const docMap = {};
      docs.forEach(d => { docMap[d.doc_type] = d; });
      setDocuments(docMap);
    } catch {}
  };

  // === PHOTO ===
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);

    // Upload
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await fetch('/api/drivers/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mb_access')}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setAvatarPreview(data.avatar_url);
        refreshUser();
      }
    } catch (e) { setError('Erreur upload photo'); }
    setLoading(false);
  };

  // === VÉHICULE ===
  const saveVehicle = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/drivers/vehicle', { vehicle_type: vehicleType, ...vehicleForm, year: vehicleForm.year ? parseInt(vehicleForm.year) : null });
      await api.patch('/drivers/me', { vehicle_type: vehicleType, license_number: licenseNumber });
      setStep(2);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // === DOCUMENTS ===
  const handleDocUpload = async (docType, file) => {
    setUploadingDoc(docType);
    try {
      const formData = new FormData();
      formData.append('doc_type', docType);
      formData.append('file', file);
      const res = await fetch('/api/drivers/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('mb_access')}` },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(prev => ({ ...prev, [docType]: data }));
      } else {
        setError(data.error || 'Erreur upload');
      }
    } catch { setError('Erreur upload document'); }
    setUploadingDoc(null);
  };

  // === SOUMISSION ===
  const submitVerification = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/drivers/submit-verification');
      navigate('/driver');
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const currentStep = STEPS[step];
  const requiredDocs = DOC_TYPES.filter(d => d.required);
  const hasRequiredDocs = requiredDocs.every(d => documents[d.id]);

  return (
    <div className="min-h-[100dvh] bg-white">
      {/* Header avec progression */}
      <div className="bg-gray-900 px-5 pt-6 pb-6">
        <div className="flex items-center gap-3 mb-5">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="p-1.5 rounded-xl hover:bg-white/10">
              <ChevronLeft size={22} className="text-white" />
            </button>
          ) : (
            <button onClick={() => navigate('/driver')} className="p-1.5 rounded-xl hover:bg-white/10">
              <X size={22} className="text-white" />
            </button>
          )}
          <div className="flex-1">
            <p className="text-white/50 text-xs">Étape {step + 1} / {STEPS.length}</p>
            <h2 className="text-white text-lg font-bold">{currentStep.title}</h2>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 rounded-full overflow-hidden bg-white/10">
              <motion.div
                className="h-full bg-brand-400 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.5 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="px-5 py-6"
        >
          {/* === Étape 1 : Photo === */}
          {step === 0 && (
            <div className="space-y-6">
              <p className="text-gray-500 text-sm text-center">{currentStep.desc}</p>

              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-32 h-32 rounded-3xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className="text-gray-300" />
                    )}
                  </div>
                  <button
                    onClick={() => avatarRef.current?.click()}
                    className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center shadow-lg border-3 border-white"
                  >
                    <Camera size={18} className="text-white" />
                  </button>
                  <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Photo claire de votre visage<br />Format JPG ou PNG
                </p>
              </div>

              <Button onClick={() => setStep(1)} disabled={loading}>
                {avatarPreview ? 'Continuer' : 'Passer cette étape'}
                <ChevronRight size={18} />
              </Button>
            </div>
          )}

          {/* === Étape 2 : Véhicule === */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-gray-500 text-sm text-center">{currentStep.desc}</p>

              {/* Type de véhicule */}
              <div>
                <label className="text-sm font-medium text-gray-600 pl-1 block mb-2">Type de véhicule</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { type: 'moto', emoji: '🏍️', label: 'Moto-taxi', desc: 'Deux roues' },
                    { type: 'car', emoji: '🚗', label: 'Voiture', desc: 'Quatre roues' },
                  ].map(v => (
                    <motion.button
                      key={v.type}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setVehicleType(v.type)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        vehicleType === v.type
                          ? 'border-brand-500 bg-brand-50 shadow-sm'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className="text-3xl">{v.emoji}</span>
                      <p className={`font-semibold mt-2 ${vehicleType === v.type ? 'text-brand-700' : 'text-gray-700'}`}>{v.label}</p>
                      <p className="text-xs text-gray-400">{v.desc}</p>
                      {vehicleType === v.type && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <Input label="Marque" placeholder="Ex: Honda, Toyota..." value={vehicleForm.brand}
                onChange={e => setVehicleForm(p => ({ ...p, brand: e.target.value }))} />
              <Input label="Modèle" placeholder="Ex: CG125, Corolla..." value={vehicleForm.model}
                onChange={e => setVehicleForm(p => ({ ...p, model: e.target.value }))} />

              <div className="grid grid-cols-2 gap-3">
                <Input label="Couleur" placeholder="Rouge, Bleu..." value={vehicleForm.color}
                  onChange={e => setVehicleForm(p => ({ ...p, color: e.target.value }))} />
                <Input label="Année" placeholder="2020" type="number" value={vehicleForm.year}
                  onChange={e => setVehicleForm(p => ({ ...p, year: e.target.value }))} />
              </div>

              <Input label="Immatriculation" placeholder="AB-1234" value={vehicleForm.plate_number}
                onChange={e => setVehicleForm(p => ({ ...p, plate_number: e.target.value.toUpperCase() }))}
                className="font-mono text-lg tracking-widest" />

              <Input label="Numéro de permis" placeholder="Ex: GW-12345678" value={licenseNumber}
                onChange={e => setLicenseNumber(e.target.value)} />

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <Button onClick={saveVehicle} loading={loading}>
                Continuer <ChevronRight size={18} />
              </Button>
            </div>
          )}

          {/* === Étape 3 : Documents === */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm text-center mb-2">{currentStep.desc}</p>

              {DOC_TYPES.map(doc => {
                const uploaded = documents[doc.id];
                const isUploading = uploadingDoc === doc.id;

                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border-2 p-4 transition-all ${
                      uploaded
                        ? 'border-green-200 bg-green-50/50'
                        : doc.required
                          ? 'border-red-200 bg-red-50/30'
                          : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{doc.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 text-sm">{doc.label}</p>
                          {doc.required && (
                            <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">
                              Obligatoire
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{doc.desc}</p>
                      </div>

                      {uploaded ? (
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                            <Check size={16} className="text-green-600" />
                          </div>
                        </div>
                      ) : isUploading ? (
                        <div className="w-8 h-8 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            fileRef.current.dataset.docType = doc.id;
                            fileRef.current.click();
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition"
                        >
                          <Upload size={14} />
                          Charger
                        </button>
                      )}
                    </div>

                    {uploaded && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-xs font-medium ${
                          uploaded.status === 'approved' ? 'text-green-600' :
                          uploaded.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {uploaded.status === 'approved' ? '✓ Approuvé' :
                           uploaded.status === 'rejected' ? '✗ Rejeté' : '⏳ En attente'}
                        </span>
                        <button
                          onClick={() => {
                            fileRef.current.dataset.docType = doc.id;
                            fileRef.current.click();
                          }}
                          className="text-xs text-brand-500 font-medium hover:underline"
                        >
                          Remplacer
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const docType = fileRef.current.dataset.docType;
                  if (file && docType) handleDocUpload(docType, file);
                  e.target.value = '';
                }}
              />

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <Button onClick={() => setStep(3)} disabled={!hasRequiredDocs}>
                {hasRequiredDocs ? 'Continuer' : 'Documents obligatoires manquants'}
                {hasRequiredDocs && <ChevronRight size={18} />}
              </Button>
            </div>
          )}

          {/* === Étape 4 : Soumission === */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-brand-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Shield size={40} className="text-brand-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800">Prêt à soumettre ?</h3>
                <p className="text-gray-500 text-sm mt-2">
                  Notre équipe vérifiera votre dossier et vous notifiera une fois validé.
                </p>
              </div>

              {/* Récapitulatif */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Récapitulatif</p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-200">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400"><User size={20} /></div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs text-gray-400">{user?.phone}</p>
                  </div>
                  <span className="ml-auto text-lg">{vehicleType === 'moto' ? '🏍️' : '🚗'}</span>
                </div>

                {vehicleForm.brand && (
                  <div className="bg-white rounded-xl p-3 text-sm">
                    <p className="font-medium">{vehicleForm.brand} {vehicleForm.model}</p>
                    <p className="text-gray-400 text-xs">{vehicleForm.color} · {vehicleForm.plate_number}</p>
                  </div>
                )}

                <div className="space-y-1">
                  {DOC_TYPES.map(doc => (
                    <div key={doc.id} className="flex items-center gap-2 text-sm">
                      {documents[doc.id] ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <X size={14} className="text-gray-300" />
                      )}
                      <span className={documents[doc.id] ? 'text-gray-700' : 'text-gray-400'}>
                        {doc.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <Button onClick={submitVerification} loading={loading} icon={Shield}>
                Soumettre mon dossier
              </Button>

              <p className="text-xs text-gray-400 text-center">
                La vérification prend généralement 24 à 48 heures
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

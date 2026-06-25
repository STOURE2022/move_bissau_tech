import { useEffect, useState, useRef } from 'react'
import { CheckCircle, XCircle, Ban, Eye, X, FileText, User, Car, Phone, ExternalLink, Bell, AlertTriangle, MessageSquare } from 'lucide-react'
import api from '../api/client'

const statusConfig = {
  pending:  { label: 'En attente', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  approved: { label: 'Approuvé', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  rejected: { label: 'Rejeté', bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
}

const docLabels = {
  identity: "Pièce d'identité",
  license: 'Permis de conduire',
  insurance: 'Assurance',
  vehicle_registration: 'Carte grise',
  criminal_record: 'Casier judiciaire',
  photo: 'Photo véhicule',
}

// Son de notification (petit beep)
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.value = 0.1
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.stop(ctx.currentTime + 0.3)
  } catch {}
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [previewImg, setPreviewImg] = useState(null)

  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null)
  // { type: 'approve'|'reject'|'suspend'|'approve_doc'|'reject_doc', driverId, docId?, comment }

  const [confirmComment, setConfirmComment] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Notification son
  const prevPendingRef = useRef(0)

  const pendingCount = drivers.filter(d => d.verification_status === 'pending').length

  useEffect(() => { loadDrivers() }, [filter])

  // Alerter quand un nouveau pending arrive
  useEffect(() => {
    if (pendingCount > prevPendingRef.current && prevPendingRef.current > 0) {
      playNotifSound()
      if (Notification.permission === 'granted') {
        new Notification('MoveBissau Admin', {
          body: `Nouveau chauffeur en attente de validation !`,
          icon: '/favicon.ico'
        })
      }
    }
    prevPendingRef.current = pendingCount
  }, [pendingCount])

  // Demander la permission notification au chargement
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Polling pour détecter les nouveaux
    const interval = setInterval(loadDrivers, 15000)
    return () => clearInterval(interval)
  }, [])

  const loadDrivers = async () => {
    setLoading(true)
    try {
      const params = filter ? `?verification_status=${filter}` : ''
      setDrivers(await api.get(`/admin/drivers${params}`))
    } catch {}
    setLoading(false)
  }

  // === Actions avec modal de confirmation ===

  const openConfirm = (type, driverId, docId = null) => {
    setConfirmModal({ type, driverId, docId })
    setConfirmComment('')
  }

  const executeConfirm = async () => {
    if (!confirmModal) return
    setConfirmLoading(true)

    const { type, driverId, docId } = confirmModal

    try {
      switch (type) {
        case 'approve':
          await api.patch(`/admin/drivers/${driverId}/verify`, {
            action: 'approve',
            rejection_reason: '',
            comment: confirmComment,
          })
          break
        case 'reject':
          if (!confirmComment.trim()) {
            alert('Veuillez indiquer un motif de rejet.')
            setConfirmLoading(false)
            return
          }
          await api.patch(`/admin/drivers/${driverId}/verify`, {
            action: 'reject',
            rejection_reason: confirmComment,
            comment: confirmComment,
          })
          break
        case 'suspend':
          if (!confirmComment.trim()) {
            alert('Veuillez indiquer un motif de suspension.')
            setConfirmLoading(false)
            return
          }
          await api.post(`/admin/drivers/${driverId}/suspend`, {
            reason: confirmComment,
          })
          break
      }
      loadDrivers()
      setSelected(null)
      setConfirmModal(null)
    } catch (e) {
      alert(e.message)
    }
    setConfirmLoading(false)
  }

  // Config des modals de confirmation
  const confirmConfig = {
    approve: {
      title: 'Approuver ce chauffeur ?',
      desc: 'Le chauffeur pourra se mettre en ligne et recevoir des courses.',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-50',
      btnColor: 'bg-green-500 hover:bg-green-600',
      btnLabel: 'Confirmer l\'approbation',
      commentRequired: false,
      commentLabel: 'Commentaire (optionnel)',
    },
    reject: {
      title: 'Rejeter ce chauffeur ?',
      desc: 'Le chauffeur sera notifié et devra resoumettre ses documents.',
      icon: XCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
      btnColor: 'bg-red-500 hover:bg-red-600',
      btnLabel: 'Confirmer le rejet',
      commentRequired: true,
      commentLabel: 'Motif du rejet (obligatoire)',
    },
    suspend: {
      title: 'Suspendre ce chauffeur ?',
      desc: 'Le chauffeur sera immédiatement mis hors ligne et ne pourra plus recevoir de courses.',
      icon: Ban,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-50',
      btnColor: 'bg-orange-500 hover:bg-orange-600',
      btnLabel: 'Confirmer la suspension',
      commentRequired: true,
      commentLabel: 'Motif de la suspension (obligatoire)',
    },
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Chauffeurs</h2>
          {pendingCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-sm flex items-center gap-1">
              <Bell size={12} />
              {pendingCount} en attente
            </span>
          )}
        </div>
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {[
            { v: '', l: `Tous (${drivers.length})` },
            { v: 'pending', l: `En attente${pendingCount ? ` (${pendingCount})` : ''}` },
            { v: 'approved', l: 'Approuvés' },
            { v: 'rejected', l: 'Rejetés' },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f.v ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Grille chauffeurs */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <User size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 font-medium">Aucun chauffeur trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drivers.map(d => {
            const status = statusConfig[d.verification_status] || statusConfig.pending
            return (
              <div
                key={d.id}
                onClick={() => setSelected(d)}
                className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  d.verification_status === 'pending' ? 'border-yellow-200 ring-1 ring-yellow-100' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
                    {d.avatar_url ? <img src={d.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={24} className="text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{d.user_name}</p>
                    <p className="text-xs text-gray-400">{d.user_phone}</p>
                  </div>
                  <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${status.bg} ${status.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {status.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { l: 'Type', v: d.vehicle_type === 'moto' ? '🏍️' : '🚗' },
                    { l: 'Note', v: `⭐ ${Number(d.average_rating).toFixed(1)}` },
                    { l: 'Courses', v: d.total_rides },
                    { l: 'Crédit', v: `${d.credit_balance} F` },
                  ].map(s => (
                    <div key={s.l} className="text-center">
                      <p className="text-xs text-gray-400">{s.l}</p>
                      <p className="text-sm font-semibold">{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400">📄 {d.documents_count} document{d.documents_count > 1 ? 's' : ''}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${d.is_online ? 'text-green-600' : 'text-gray-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${d.is_online ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {d.is_online ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* === Panneau latéral détail === */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setSelected(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white z-50 shadow-2xl overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white px-6 pt-6 pb-8 flex-shrink-0">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold">Dossier chauffeur</h3>
                <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-white/10">
                  <X size={20} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 rounded-2xl overflow-hidden flex items-center justify-center">
                  {selected.avatar_url ? <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" /> : <User size={32} className="text-white/40" />}
                </div>
                <div className="flex-1">
                  <p className="text-xl font-bold">{selected.user_name}</p>
                  <p className="text-gray-400 text-sm flex items-center gap-1.5"><Phone size={12} /> {selected.user_phone}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {(() => {
                      const s = statusConfig[selected.verification_status] || statusConfig.pending
                      return <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}><span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}</span>
                    })()}
                    <span className="text-xs text-gray-400">{selected.vehicle_type === 'moto' ? '🏍️ Moto-taxi' : '🚗 Voiture'}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-5">
                {[
                  { label: 'Note', value: `⭐ ${Number(selected.average_rating).toFixed(1)}` },
                  { label: 'Courses', value: selected.total_rides },
                  { label: 'Crédit', value: `${selected.credit_balance} F` },
                  { label: 'Docs', value: selected.documents_count },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl p-2 text-center">
                    <p className="text-white font-bold text-sm">{s.value}</p>
                    <p className="text-white/40 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contenu */}
            <div className="flex-1 p-6 space-y-6">
              {/* Véhicule */}
              {selected.vehicles?.length > 0 && (
                <section>
                  <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-3"><Car size={16} className="text-gray-500" /> Véhicule</h4>
                  {selected.vehicles.map(v => (
                    <div key={v.id} className="bg-gray-50 rounded-xl p-4 flex items-center gap-4">
                      <span className="text-3xl">{v.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{v.brand} {v.model}</p>
                        <p className="text-sm text-gray-500">{v.color} · {v.year || ''}</p>
                      </div>
                      <div className="bg-white rounded-lg px-3 py-2 border">
                        <p className="font-mono font-bold text-lg tracking-wider text-gray-800">{v.plate_number}</p>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* Documents — avec actions par document */}
              <section>
                <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-gray-500" /> Documents ({selected.documents?.length || 0})
                </h4>

                {selected.documents?.length > 0 ? (
                  <div className="space-y-2">
                    {selected.documents.map(doc => {
                      const ds = statusConfig[doc.status] || statusConfig.pending
                      return (
                        <div key={doc.id} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              doc.status === 'approved' ? 'bg-green-100' : doc.status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'
                            }`}>
                              <FileText size={18} className={
                                doc.status === 'approved' ? 'text-green-600' : doc.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                              } />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-gray-800">{docLabels[doc.doc_type] || doc.doc_type}</p>
                              <p className="text-[11px] text-gray-400">{new Date(doc.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                              {doc.rejection_reason && <p className="text-xs text-red-500 mt-0.5">Motif : {doc.rejection_reason}</p>}
                            </div>

                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ds.bg} ${ds.text}`}>{ds.label}</span>

                            {/* Bouton voir */}
                            {doc.file_url && (
                              <button
                                onClick={e => {
                                  e.stopPropagation()
                                  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_url)) {
                                    setPreviewImg(doc.file_url)
                                  } else {
                                    window.open(doc.file_url, '_blank')
                                  }
                                }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                              >
                                <Eye size={12} /> Voir
                              </button>
                            )}
                          </div>

                          {/* Actions par document (seulement si pending) */}
                          {doc.status === 'pending' && selected.verification_status === 'pending' && (
                            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                              <button
                                onClick={e => { e.stopPropagation(); openConfirm('approve_doc', selected.id, doc.id) }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition"
                              >
                                <CheckCircle size={14} /> Valider
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); openConfirm('reject_doc', selected.id, doc.id) }}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition"
                              >
                                <XCircle size={14} /> Refuser
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-400 text-sm">Aucun document soumis</p>
                  </div>
                )}
              </section>
            </div>

            {/* Actions globales en bas */}
            {selected.verification_status === 'pending' && (
              <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-500 text-center mb-3">Vérifiez les documents avant de valider le dossier complet</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => openConfirm('approve', selected.id)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <CheckCircle size={18} /> Approuver le dossier
                  </button>
                  <button
                    onClick={() => openConfirm('reject', selected.id)}
                    className="flex-1 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    <XCircle size={18} /> Rejeter
                  </button>
                </div>
              </div>
            )}

            {selected.verification_status === 'approved' && (
              <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => openConfirm('suspend', selected.id)}
                  className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                >
                  <Ban size={18} /> Suspendre ce chauffeur
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* === MODAL DE CONFIRMATION === */}
      {confirmModal && (() => {
        // Pour les actions document, on utilise une config spéciale
        let config
        if (confirmModal.type === 'approve_doc') {
          config = {
            title: 'Valider ce document ?',
            desc: `Le document sera marqué comme approuvé.`,
            icon: CheckCircle,
            iconColor: 'text-green-500',
            iconBg: 'bg-green-50',
            btnColor: 'bg-green-500 hover:bg-green-600',
            btnLabel: 'Valider le document',
            commentRequired: false,
            commentLabel: 'Commentaire (optionnel)',
          }
        } else if (confirmModal.type === 'reject_doc') {
          config = {
            title: 'Refuser ce document ?',
            desc: 'Le chauffeur devra resoumettre ce document.',
            icon: XCircle,
            iconColor: 'text-red-500',
            iconBg: 'bg-red-50',
            btnColor: 'bg-red-500 hover:bg-red-600',
            btnLabel: 'Refuser le document',
            commentRequired: true,
            commentLabel: 'Motif du refus (obligatoire)',
          }
        } else {
          config = confirmConfig[confirmModal.type]
        }

        if (!config) return null
        const Icon = config.icon

        // Pour les actions document, handler spécial
        const handleDocAction = async () => {
          if (config.commentRequired && !confirmComment.trim()) {
            alert('Veuillez indiquer un motif.')
            return
          }
          setConfirmLoading(true)
          try {
            const action = confirmModal.type === 'approve_doc' ? 'approve' : 'reject'
            await api.patch(
              `/admin/drivers/${confirmModal.driverId}/documents/${confirmModal.docId}`,
              { action, comment: confirmComment }
            )
            // Recharger le chauffeur sélectionné pour voir le changement
            const updatedDrivers = await api.get(`/admin/drivers`)
            setDrivers(updatedDrivers)
            const updatedSelected = updatedDrivers.find(d => d.id === confirmModal.driverId)
            if (updatedSelected) setSelected(updatedSelected)
            setConfirmModal(null)
          } catch (e) { alert(e.message) }
          setConfirmLoading(false)
        }

        return (
          <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={() => setConfirmModal(null)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                {/* Icône */}
                <div className="flex justify-center mb-4">
                  <div className={`w-14 h-14 ${config.iconBg} rounded-2xl flex items-center justify-center`}>
                    <Icon size={28} className={config.iconColor} />
                  </div>
                </div>

                {/* Titre */}
                <h3 className="text-lg font-bold text-gray-900 text-center">{config.title}</h3>
                <p className="text-sm text-gray-500 text-center mt-1 mb-5">{config.desc}</p>

                {/* Commentaire */}
                <div className="mb-5">
                  <label className="text-sm font-medium text-gray-700 block mb-1.5 flex items-center gap-1.5">
                    <MessageSquare size={14} />
                    {config.commentLabel}
                  </label>
                  <textarea
                    value={confirmComment}
                    onChange={e => setConfirmComment(e.target.value)}
                    rows={3}
                    placeholder={config.commentRequired ? 'Ce champ est obligatoire...' : 'Ajoutez un commentaire...'}
                    className={`w-full border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 transition ${
                      config.commentRequired && !confirmComment.trim()
                        ? 'border-red-300 focus:ring-red-300'
                        : 'border-gray-200 focus:ring-green-300 focus:border-green-400'
                    }`}
                  />
                </div>

                {/* Boutons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmModal.type.includes('doc') ? handleDocAction : executeConfirm}
                    disabled={confirmLoading || (config.commentRequired && !confirmComment.trim())}
                    className={`flex-1 py-3 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50 ${config.btnColor}`}
                  >
                    {confirmLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Icon size={16} />
                        {config.btnLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* === Preview image === */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setPreviewImg(null)}>
          <button className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition" onClick={() => setPreviewImg(null)}>
            <X size={24} className="text-white" />
          </button>
          <img src={previewImg} alt="Document" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
          <a href={previewImg} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="absolute bottom-6 right-6 flex items-center gap-2 bg-white text-gray-800 px-4 py-2 rounded-xl font-medium text-sm hover:bg-gray-100 transition shadow-lg"
          >
            <ExternalLink size={14} /> Plein écran
          </a>
        </div>
      )}
    </div>
  )
}

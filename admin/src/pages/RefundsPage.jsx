import { useEffect, useState } from 'react'
import { RotateCcw, CheckCircle, XCircle, X, User, Phone, Clock, MessageSquare, AlertTriangle } from 'lucide-react'
import api from '../api/client'

const statusConfig = {
  pending:   { label: 'En attente',  bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  approved:  { label: 'Approuve',    bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  processed: { label: 'Traite',      bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500' },
  rejected:  { label: 'Rejete',      bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-500' },
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  // Modal de confirmation
  const [confirmModal, setConfirmModal] = useState(null) // { type: 'approve'|'reject', refundId }
  const [confirmNote, setConfirmNote] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => { loadRefunds() }, [])

  const loadRefunds = async () => {
    setLoading(true)
    try {
      setRefunds(await api.get('/admin/refunds'))
    } catch {}
    setLoading(false)
  }

  // Filtrage
  const filtered = refunds.filter(r => {
    if (!filter) return true
    if (filter === 'approved') return r.status === 'approved' || r.status === 'processed'
    return r.status === filter
  })

  const pendingCount = refunds.filter(r => r.status === 'pending').length

  const openConfirm = (type, refundId) => {
    setConfirmModal({ type, refundId })
    setConfirmNote('')
  }

  const executeConfirm = async () => {
    if (!confirmModal) return
    setConfirmLoading(true)
    const { type, refundId } = confirmModal
    try {
      if (type === 'reject' && !confirmNote.trim()) {
        alert('Veuillez indiquer un motif de rejet.')
        setConfirmLoading(false)
        return
      }
      await api.post(`/admin/refunds/${refundId}/${type}`, { note: confirmNote })
      await loadRefunds()
      setSelected(null)
      setConfirmModal(null)
    } catch (e) {
      alert(e.message)
    }
    setConfirmLoading(false)
  }

  const confirmConfig = {
    approve: {
      title: 'Approuver ce remboursement ?',
      desc: 'Le passager sera rembourse selon la methode choisie.',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-50',
      btnColor: 'bg-green-500 hover:bg-green-600',
      btnLabel: "Confirmer l'approbation",
      commentRequired: false,
      commentLabel: 'Note admin (optionnel)',
    },
    reject: {
      title: 'Rejeter ce remboursement ?',
      desc: 'Le passager sera notifie du rejet de sa demande.',
      icon: XCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-50',
      btnColor: 'bg-red-500 hover:bg-red-600',
      btnLabel: 'Confirmer le rejet',
      commentRequired: true,
      commentLabel: 'Motif du rejet (obligatoire)',
    },
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Remboursements</h2>
          {pendingCount > 0 && (
            <span className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
              <Clock size={12} />
              {pendingCount} en attente
            </span>
          )}
        </div>
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {[
            { v: '', l: `Tous (${refunds.length})` },
            { v: 'pending', l: `En attente${pendingCount ? ` (${pendingCount})` : ''}` },
            { v: 'approved', l: 'Approuves' },
            { v: 'rejected', l: 'Rejetes' },
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

      {/* Layout : Table + Panneau lateral */}
      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <RotateCcw size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="font-medium">Aucun remboursement trouve</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Passager</th>
                  <th className="text-right px-5 py-3">Montant</th>
                  <th className="text-left px-5 py-3">Raison</th>
                  <th className="text-center px-5 py-3">Statut</th>
                  <th className="text-right px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const status = statusConfig[r.status] || statusConfig.pending
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer hover:bg-gray-50 transition ${selected?.id === r.id ? 'bg-green-50' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{r.passenger_name}</p>
                          <p className="text-xs text-gray-400">{r.passenger_phone}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-sm font-bold text-gray-800">{r.amount} F</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-gray-600">{r.reason_display || r.reason}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {r.status_display || status.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-gray-400">
                        {new Date(r.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Panneau lateral details */}
        {selected && (
          <div className="w-[380px] bg-white rounded-2xl border border-gray-200 p-5 flex-shrink-0 self-start sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Details remboursement</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Passager */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center">
                <User size={20} className="text-gray-400" />
              </div>
              <div>
                <p className="font-bold text-gray-800">{selected.passenger_name}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone size={12} /> {selected.passenger_phone}
                </p>
              </div>
            </div>

            {/* Montant */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Montant demande</p>
              <p className="text-2xl font-bold text-gray-900">{selected.amount} F</p>
              {selected.ride_price && (
                <p className="text-xs text-gray-400 mt-1">Prix de la course : {selected.ride_price} F</p>
              )}
            </div>

            {/* Infos */}
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Course</span>
                <span className="font-semibold text-gray-800">#{selected.ride_id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Raison</span>
                <span className="font-semibold text-gray-800">{selected.reason_display || selected.reason}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Methode</span>
                <span className="font-semibold text-gray-800">{selected.refund_method || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Statut</span>
                {(() => {
                  const s = statusConfig[selected.status] || statusConfig.pending
                  return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {selected.status_display || s.label}
                    </span>
                  )
                })()}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Date</span>
                <span className="font-semibold text-gray-800">
                  {new Date(selected.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              {selected.processed_at && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Traite le</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(selected.processed_at).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            {/* Note admin */}
            {selected.admin_note && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-5">
                <p className="text-xs text-blue-700">
                  <strong>Note admin :</strong> {selected.admin_note}
                </p>
              </div>
            )}

            {/* Actions */}
            {selected.status === 'pending' && (
              <div className="border-t pt-4 space-y-2">
                <button
                  onClick={() => openConfirm('approve', selected.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition"
                >
                  <CheckCircle size={16} /> Approuver le remboursement
                </button>
                <button
                  onClick={() => openConfirm('reject', selected.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 rounded-xl text-sm font-semibold transition"
                >
                  <XCircle size={16} /> Rejeter
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      {confirmModal && (() => {
        const config = confirmConfig[confirmModal.type]
        if (!config) return null
        const Icon = config.icon

        return (
          <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={() => setConfirmModal(null)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                {/* Icone */}
                <div className="flex justify-center mb-4">
                  <div className={`w-14 h-14 ${config.iconBg} rounded-2xl flex items-center justify-center`}>
                    <Icon size={28} className={config.iconColor} />
                  </div>
                </div>

                {/* Titre */}
                <h3 className="text-lg font-bold text-gray-900 text-center">{config.title}</h3>
                <p className="text-sm text-gray-500 text-center mt-1 mb-5">{config.desc}</p>

                {/* Note */}
                <div className="mb-5">
                  <label className="text-sm font-medium text-gray-700 block mb-1.5 flex items-center gap-1.5">
                    <MessageSquare size={14} />
                    {config.commentLabel}
                  </label>
                  <textarea
                    value={confirmNote}
                    onChange={e => setConfirmNote(e.target.value)}
                    rows={3}
                    placeholder={config.commentRequired ? 'Ce champ est obligatoire...' : 'Ajoutez une note...'}
                    className={`w-full border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 transition ${
                      config.commentRequired && !confirmNote.trim()
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
                    onClick={executeConfirm}
                    disabled={confirmLoading || (config.commentRequired && !confirmNote.trim())}
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
    </div>
  )
}

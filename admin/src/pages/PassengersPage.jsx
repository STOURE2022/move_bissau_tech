import { useEffect, useState } from 'react'
import { Search, User, Phone, Ban, ShieldOff, X, AlertTriangle, CreditCard, CheckCircle, KeyRound } from 'lucide-react'
import api from '../api/client'

export default function PassengersPage() {
  const [passengers, setPassengers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | banned | debt
  const [selected, setSelected] = useState(null)

  // Modal ban/unban
  const [banModal, setBanModal] = useState(null)
  const [banReason, setBanReason] = useState('')
  const [banLoading, setBanLoading] = useState(false)

  // Modal reset password
  const [resetModal, setResetModal] = useState(null) // userId
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleResetPassword = async () => {
    if (!resetModal || resetPassword.length < 6) return
    setResetLoading(true)
    try {
      await api.post(`/admin/users/${resetModal}/reset-password`, { new_password: resetPassword })
      alert('Mot de passe réinitialisé avec succès !')
      setResetModal(null)
      setResetPassword('')
    } catch (e) { alert(e.message) }
    setResetLoading(false)
  }

  useEffect(() => { loadPassengers() }, [])

  const loadPassengers = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/passengers')
      setPassengers(data)
    } catch {}
    setLoading(false)
  }

  const handleBan = async () => {
    if (!banModal) return
    setBanLoading(true)
    try {
      const data = await api.post(`/admin/passengers/${banModal.userId}/ban`, {
        action: banModal.action,
        reason: banReason,
      })
      setPassengers(prev => prev.map(p => p.id === data.id ? data : p))
      if (selected?.id === data.id) setSelected(data)
      setBanModal(null)
      setBanReason('')
    } catch (e) { alert(e.message) }
    setBanLoading(false)
  }

  const clearDebt = async (userId) => {
    try {
      const data = await api.post(`/admin/passengers/${userId}/clear-debt`)
      setPassengers(prev => prev.map(p => p.id === data.id ? data : p))
      if (selected?.id === data.id) setSelected(data)
    } catch (e) { alert(e.message) }
  }

  // Filtrage
  const filtered = passengers.filter(p => {
    if (filter === 'banned' && !p.is_banned) return false
    if (filter === 'debt' && !p.cancellation_debt) return false
    if (search) {
      const q = search.toLowerCase()
      return p.phone.includes(q) || p.full_name.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Passagers</h2>
          <span className="bg-gray-100 text-gray-600 text-sm font-semibold px-3 py-1 rounded-full">
            {passengers.length}
          </span>
        </div>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'banned', label: 'Bannis' },
            { id: 'debt', label: 'Avec dette' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout : Table + Panneau latéral */}
      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <User size={40} className="mx-auto text-gray-300 mb-3" />
              <p>Aucun passager trouvé</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Passager</th>
                  <th className="text-left px-5 py-3">Téléphone</th>
                  <th className="text-center px-5 py-3">Courses</th>
                  <th className="text-center px-5 py-3">Statut</th>
                  <th className="text-right px-5 py-3">Dette</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`cursor-pointer hover:bg-gray-50 transition ${selected?.id === p.id ? 'bg-green-50' : ''}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User size={16} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{p.full_name}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(p.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600 font-mono">{p.phone}</td>
                    <td className="px-5 py-3 text-center text-sm font-semibold text-gray-700">{p.total_rides}</td>
                    <td className="px-5 py-3 text-center">
                      {p.is_banned ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                          <Ban size={10} /> Banni
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                          <CheckCircle size={10} /> Actif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {p.cancellation_debt > 0 ? (
                        <span className="text-sm font-semibold text-red-600">{p.cancellation_debt} F</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Panneau latéral détails */}
        {selected && (
          <div className="w-[340px] bg-white rounded-2xl border border-gray-200 p-5 flex-shrink-0 self-start sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">Détails passager</h3>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Profil */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center overflow-hidden">
                {selected.avatar_url ? (
                  <img src={selected.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={24} className="text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-bold text-gray-800">{selected.full_name}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Phone size={12} /> {selected.phone}
                </p>
              </div>
            </div>

            {/* Infos */}
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Courses</span>
                <span className="font-semibold text-gray-800">{selected.total_rides}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Langue</span>
                <span className="font-semibold text-gray-800">
                  {selected.preferred_lang === 'fr' ? 'Français' : selected.preferred_lang === 'pt' ? 'Português' : 'Kriol'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Inscrit le</span>
                <span className="font-semibold text-gray-800">
                  {new Date(selected.created_at).toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Statut</span>
                {selected.is_banned ? (
                  <span className="text-red-600 font-semibold">Banni</span>
                ) : (
                  <span className="text-green-600 font-semibold">Actif</span>
                )}
              </div>
              {selected.ban_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs text-red-700"><strong>Motif :</strong> {selected.ban_reason}</p>
                </div>
              )}
              {selected.cancellation_debt > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-yellow-800">Dette d'annulation</p>
                    <p className="text-lg font-bold text-yellow-700">{selected.cancellation_debt} F</p>
                  </div>
                  <button
                    onClick={() => clearDebt(selected.id)}
                    className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Effacer
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t pt-4 space-y-2">
              <button
                onClick={() => { setResetModal(selected.id); setResetPassword(''); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold transition"
              >
                <KeyRound size={16} /> Réinitialiser le mot de passe
              </button>
              {selected.is_banned ? (
                <button
                  onClick={() => setBanModal({ userId: selected.id, action: 'unban' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition"
                >
                  <ShieldOff size={16} /> Débannir le passager
                </button>
              ) : (
                <button
                  onClick={() => setBanModal({ userId: selected.id, action: 'ban' })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition"
                >
                  <Ban size={16} /> Bannir le passager
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Ban/Unban */}
      {banModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                banModal.action === 'ban' ? 'bg-red-50' : 'bg-green-50'
              }`}>
                {banModal.action === 'ban'
                  ? <Ban size={24} className="text-red-500" />
                  : <CheckCircle size={24} className="text-green-500" />
                }
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">
                  {banModal.action === 'ban' ? 'Bannir ce passager ?' : 'Débannir ce passager ?'}
                </h3>
                <p className="text-sm text-gray-500">
                  {banModal.action === 'ban'
                    ? 'Il ne pourra plus commander de courses.'
                    : 'Il pourra à nouveau utiliser l\'application.'
                  }
                </p>
              </div>
            </div>

            {banModal.action === 'ban' && (
              <textarea
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder="Motif du bannissement..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 mb-4"
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setBanModal(null); setBanReason('') }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleBan}
                disabled={banLoading || (banModal.action === 'ban' && !banReason.trim())}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50 ${
                  banModal.action === 'ban'
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
              >
                {banLoading ? 'En cours...' : banModal.action === 'ban' ? 'Confirmer le ban' : 'Débannir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50">
                <KeyRound size={24} className="text-blue-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-lg">Réinitialiser le mot de passe</h3>
                <p className="text-sm text-gray-500">Définissez un nouveau mot de passe pour cet utilisateur</p>
              </div>
            </div>

            <input
              type="text"
              value={resetPassword}
              onChange={e => setResetPassword(e.target.value)}
              placeholder="Nouveau mot de passe (min 6 caractères)"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 mb-4 font-mono"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setResetModal(null); setResetPassword(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || resetPassword.length < 6}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition disabled:opacity-50"
              >
                {resetLoading ? 'En cours...' : 'Réinitialiser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import api from '../api/client'
import StatusBadge from '../components/ui/StatusBadge'
import RideReceipt from '../components/ui/RideReceipt'

export default function RidesPage() {
  const [rides, setRides] = useState([])
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [receiptRide, setReceiptRide] = useState(null)

  useEffect(() => { loadRides() }, [filter])

  const loadRides = async () => {
    setLoading(true)
    try {
      const params = filter ? `?status=${filter}` : ''
      const data = await api.get(`/admin/rides${params}`)
      setRides(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const statuses = ['', 'driver_assigned', 'driver_en_route', 'passenger_onboard', 'completed', 'paid', 'cancelled']
  const statusLabels = {
    '': 'Toutes',
    driver_assigned: 'Assignée',
    driver_en_route: 'En route',
    passenger_onboard: 'En course',
    completed: 'Terminée',
    paid: 'Payée',
    cancelled: 'Annulée',
  }

  // Filtrage côté client
  const filtered = rides.filter(r => {
    // Recherche texte
    if (search) {
      const q = search.toLowerCase()
      const match = (r.passenger_name || '').toLowerCase().includes(q)
        || (r.driver_name || '').toLowerCase().includes(q)
        || (r.pickup_address || '').toLowerCase().includes(q)
        || (r.dropoff_address || '').toLowerCase().includes(q)
        || (r.id || '').toLowerCase().includes(q)
      if (!match) return false
    }
    // Véhicule
    if (vehicleFilter) {
      const vType = r.driver_vehicle?.type || r.vehicle_type
      if (vType !== vehicleFilter) return false
    }
    // Date
    if (dateFrom) {
      const rDate = new Date(r.created_at).toISOString().slice(0, 10)
      if (rDate < dateFrom) return false
    }
    if (dateTo) {
      const rDate = new Date(r.created_at).toISOString().slice(0, 10)
      if (rDate > dateTo) return false
    }
    return true
  })

  const hasFilters = search || vehicleFilter || dateFrom || dateTo
  const clearFilters = () => { setSearch(''); setVehicleFilter(''); setDateFrom(''); setDateTo('') }

  // Stats rapides
  const totalRevenue = filtered.reduce((s, r) => s + Number(r.agreed_price || 0), 0)
  const totalCommission = filtered.reduce((s, r) => s + Number(r.commission_amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Courses</h2>
        <div className="flex gap-1 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filter === s ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {statusLabels[s] || s}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres avancés */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Recherche */}
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Recherche</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Passager, chauffeur, adresse, ID..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {/* Véhicule */}
          <div className="min-w-[120px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Véhicule</label>
            <select
              value={vehicleFilter}
              onChange={e => setVehicleFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="">Tous</option>
              <option value="moto">Moto</option>
              <option value="car">Voiture</option>
            </select>
          </div>
          {/* Date de */}
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {/* Date à */}
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          {/* Reset */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-red-500 font-medium hover:bg-red-50 rounded-lg border border-red-200"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Résumé filtré */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span><strong className="text-gray-800">{filtered.length}</strong> courses</span>
          <span>Revenus : <strong className="text-gray-800">{totalRevenue.toLocaleString()} F</strong></span>
          <span>Commission : <strong className="text-primary">{totalCommission.toLocaleString()} F</strong></span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Passager</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Chauffeur</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Trajet</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prix</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Commission</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">Aucune course trouvée</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{r.id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm">{r.passenger_name}</td>
                  <td className="px-4 py-3 text-sm">{r.driver_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">
                    {r.pickup_address} → {r.dropoff_address}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.agreed_price} F</td>
                  <td className="px-4 py-3 text-sm text-primary font-medium">{r.commission_amount || '-'} F</td>
                  <td className="px-4 py-3 text-sm">{(r.driver_vehicle?.type || r.vehicle_type) === 'car' ? '🚗' : '🏍️'}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleDateString('fr')}
                  </td>
                  <td className="px-4 py-3">
                    {['paid', 'completed'].includes(r.status) && (
                      <button
                        onClick={() => setReceiptRide(r)}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        📄 Reçu
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {receiptRide && (
        <RideReceipt ride={receiptRide} onClose={() => setReceiptRide(null)} />
      )}
    </div>
  )
}

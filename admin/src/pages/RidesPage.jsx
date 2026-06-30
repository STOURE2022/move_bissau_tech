import { useEffect, useState } from 'react'
import api from '../api/client'
import StatusBadge from '../components/ui/StatusBadge'
import RideReceipt from '../components/ui/RideReceipt'

export default function RidesPage() {
  const [rides, setRides] = useState([])
  const [filter, setFilter] = useState('')
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
              {s || 'Toutes'}
            </button>
          ))}
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
              ) : rides.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-gray-400">Aucune course</td></tr>
              ) : rides.map(r => (
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

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { RefreshCw } from 'lucide-react'
import api from '../api/client'
import StatusBadge from '../components/ui/StatusBadge'

export default function RidesLivePage() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLive()
    // Rafraîchir toutes les 10 secondes
    const interval = setInterval(loadLive, 10000)
    return () => clearInterval(interval)
  }, [])

  const loadLive = async () => {
    try {
      const data = await api.get('/admin/rides/live')
      setRides(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Courses en direct
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {rides.length} actives
          </span>
        </h2>
        <button
          onClick={loadLive}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* Carte */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: '400px' }}>
        <MapContainer
          center={[11.8636, -15.5977]} // Centre de Bissau
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {/* Les markers seraient positionnés avec les coordonnées GPS des courses */}
        </MapContainer>
      </div>

      {/* Liste des courses actives */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Passager</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Chauffeur</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prix</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Depuis</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rides.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">
                  Aucune course en cours
                </td></tr>
              ) : rides.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.passenger_name}</td>
                  <td className="px-4 py-3 text-sm">{r.driver_name}</td>
                  <td className="px-4 py-3 font-medium">{r.agreed_price} F</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleTimeString('fr')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

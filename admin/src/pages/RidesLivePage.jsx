import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { RefreshCw } from 'lucide-react'
import api from '../api/client'
import StatusBadge from '../components/ui/StatusBadge'
import L from 'leaflet'

// Icônes pour la carte
const driverIcon = (type) => L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#1B8A4E;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="font-size:14px">${type === 'car' ? '🚗' : '🏍️'}</span></div>`,
  iconSize: [32, 32], iconAnchor: [16, 16],
})

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [10, 10], iconAnchor: [5, 5],
})

const dropoffIcon = L.divIcon({
  className: '',
  html: `<div style="width:10px;height:10px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [10, 10], iconAnchor: [5, 5],
})

// Composant pour recentrer la carte
function MapUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom(), { animate: true, duration: 0.5 })
    }
  }, [center?.[0], center?.[1], zoom])
  return null
}

const statusLabels = {
  driver_assigned: 'Assignée',
  driver_en_route: 'En route',
  driver_arrived: 'Arrivé',
  passenger_onboard: 'En course',
  completed: 'Terminée',
}

export default function RidesLivePage() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [focusRide, setFocusRide] = useState(null)

  // Filtres
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('')

  useEffect(() => {
    api.get('/admin/config').then(configs => {
      const lat = configs.find(c => c.key === 'default_lat')?.value || 11.8636
      const lng = configs.find(c => c.key === 'default_lng')?.value || -15.5977
      setConfig({ lat: parseFloat(lat), lng: parseFloat(lng) })
    }).catch(() => setConfig({ lat: 11.8636, lng: -15.5977 }))

    loadLive()
    const interval = setInterval(loadLive, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadLive = async () => {
    try {
      const data = await api.get('/admin/rides/live')
      setRides(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  // Filtrage côté client
  const filtered = rides.filter(r => {
    if (search) {
      const q = search.toLowerCase()
      const match = (r.passenger_name || '').toLowerCase().includes(q)
        || (r.driver_name || '').toLowerCase().includes(q)
        || (r.pickup_address || '').toLowerCase().includes(q)
        || (r.dropoff_address || '').toLowerCase().includes(q)
        || (r.id || '').toLowerCase().includes(q)
      if (!match) return false
    }
    if (statusFilter && r.status !== statusFilter) return false
    if (vehicleFilter) {
      const vType = r.driver_vehicle?.type || r.vehicle_type
      if (vType !== vehicleFilter) return false
    }
    return true
  })

  const hasFilters = search || statusFilter || vehicleFilter
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setVehicleFilter('') }

  const mapCenter = config ? [config.lat, config.lng] : [11.8636, -15.5977]
  const activeStatuses = [...new Set(rides.map(r => r.status))]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Courses en direct
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {filtered.length} actives
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

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Recherche</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Passager, chauffeur, adresse..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Statut</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
            >
              <option value="">Tous</option>
              {activeStatuses.map(s => (
                <option key={s} value={s}>{statusLabels[s] || s}</option>
              ))}
            </select>
          </div>
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
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-xs text-red-500 font-medium hover:bg-red-50 rounded-lg border border-red-200"
            >
              Effacer
            </button>
          )}
        </div>
      </div>

      {/* Carte */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: '400px' }}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OSM'
          />
          <MapUpdater
            center={focusRide
              ? [focusRide.driver_lat || focusRide.pickup_lat, focusRide.driver_lng || focusRide.pickup_lng]
              : mapCenter
            }
            zoom={focusRide ? 16 : undefined}
          />

          {filtered.map(r => (
            <span key={r.id}>
              {r.driver_lat && r.driver_lng && (
                <Marker position={[r.driver_lat, r.driver_lng]} icon={driverIcon(r.driver_vehicle?.type || r.vehicle_type)}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold">{r.driver_name}</p>
                      <p className="text-gray-500">{statusLabels[r.status] || r.status} · {r.agreed_price} F</p>
                      <p className="text-xs text-gray-400">{r.pickup_address} → {r.dropoff_address}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {r.pickup_lat && r.pickup_lng && (
                <Marker position={[r.pickup_lat, r.pickup_lng]} icon={pickupIcon} />
              )}
              {r.dropoff_lat && r.dropoff_lng && (
                <Marker position={[r.dropoff_lat, r.dropoff_lng]} icon={dropoffIcon} />
              )}
            </span>
          ))}
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Trajet</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prix</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Depuis</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">
                  {loading ? 'Chargement...' : 'Aucune course en cours'}
                </td></tr>
              ) : filtered.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setFocusRide(focusRide?.id === r.id ? null : r)}
                  className={`hover:bg-gray-50 cursor-pointer transition ${focusRide?.id === r.id ? 'bg-green-50 ring-1 ring-green-200' : ''}`}
                >
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id?.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.passenger_name}</td>
                  <td className="px-4 py-3 text-sm">{r.driver_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">
                    {r.pickup_address} → {r.dropoff_address}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.agreed_price} F</td>
                  <td className="px-4 py-3 text-sm">{(r.driver_vehicle?.type || r.vehicle_type) === 'car' ? '🚗' : '🏍️'}</td>
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

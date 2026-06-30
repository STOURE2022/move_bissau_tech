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

export default function RidesLivePage() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [focusRide, setFocusRide] = useState(null) // course sélectionnée pour zoom

  useEffect(() => {
    // Charger la config pays pour le centre de la carte
    api.get('/admin/config').then(configs => {
      const lat = configs.find(c => c.key === 'default_lat')?.value || 11.8636
      const lng = configs.find(c => c.key === 'default_lng')?.value || -15.5977
      setConfig({ lat: parseFloat(lat), lng: parseFloat(lng) })
    }).catch(() => setConfig({ lat: 11.8636, lng: -15.5977 }))

    loadLive()
    const interval = setInterval(loadLive, 5000) // 5s au lieu de 10s
    return () => clearInterval(interval)
  }, [])

  const loadLive = async () => {
    try {
      const data = await api.get('/admin/rides/live')
      setRides(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const mapCenter = config ? [config.lat, config.lng] : [11.8636, -15.5977]

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

          {/* Marqueurs des courses actives */}
          {rides.map(r => (
            <span key={r.id}>
              {/* Position chauffeur */}
              {r.driver_lat && r.driver_lng && (
                <Marker position={[r.driver_lat, r.driver_lng]} icon={driverIcon(r.vehicle_type)}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold">{r.driver_name}</p>
                      <p className="text-gray-500">{r.status} · {r.agreed_price} F</p>
                      <p className="text-xs text-gray-400">{r.pickup_address} → {r.dropoff_address}</p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {/* Pickup */}
              {r.pickup_lat && r.pickup_lng && (
                <Marker position={[r.pickup_lat, r.pickup_lng]} icon={pickupIcon} />
              )}
              {/* Dropoff */}
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
                <tr
                  key={r.id}
                  onClick={() => setFocusRide(focusRide?.id === r.id ? null : r)}
                  className={`hover:bg-gray-50 cursor-pointer transition ${focusRide?.id === r.id ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}
                >
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

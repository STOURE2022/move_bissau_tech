import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { RefreshCw, Phone, Star, Search } from 'lucide-react'
import api from '../api/client'
import L from 'leaflet'

const motoIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#1B8A4E;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="font-size:16px">🏍️</span></div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
})

const carIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#2563EB;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center"><span style="font-size:16px">🚗</span></div>`,
  iconSize: [36, 36], iconAnchor: [18, 18],
})

function MapUpdater({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom(), { animate: true, duration: 0.5 })
    }
  }, [center?.[0], center?.[1], zoom])
  return null
}

export default function DriversOnlinePage() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [config, setConfig] = useState(null)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all') // all, moto, car

  useEffect(() => {
    api.get('/admin/config').then(configs => {
      const lat = configs.find(c => c.key === 'default_lat')?.value || 11.8636
      const lng = configs.find(c => c.key === 'default_lng')?.value || -15.5977
      setConfig({ lat: parseFloat(lat), lng: parseFloat(lng) })
    }).catch(() => setConfig({ lat: 11.8636, lng: -15.5977 }))

    loadDrivers()
    const interval = setInterval(loadDrivers, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadDrivers = async () => {
    try {
      const data = await api.get('/admin/drivers/online')
      setDrivers(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const motos = drivers.filter(d => d.vehicle_type === 'moto')
  const cars = drivers.filter(d => d.vehicle_type === 'car')
  const withGps = drivers.filter(d => d.lat && d.lng)

  // Filtrage
  const filtered = drivers.filter(d => {
    if (filterType === 'moto' && d.vehicle_type !== 'moto') return false
    if (filterType === 'car' && d.vehicle_type !== 'car') return false
    if (search) {
      const q = search.toLowerCase()
      return d.name.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        (d.plate || '').toLowerCase().includes(q) ||
        (d.vehicle_info || '').toLowerCase().includes(q)
    }
    return true
  })

  const mapCenter = selected?.lat ? [selected.lat, selected.lng]
    : config ? [config.lat, config.lng] : [11.8636, -15.5977]

  const timeSince = (isoDate) => {
    if (!isoDate) return '—'
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    return `${Math.floor(diff / 3600)}h`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Chauffeurs en ligne</h2>
        <button
          onClick={loadDrivers}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-3xl font-bold text-brand-600">{drivers.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total en ligne</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-3xl font-bold text-red-500">{motos.length}</p>
          <p className="text-xs text-gray-500 mt-1">🏍️ Motos</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-3xl font-bold text-blue-500">{cars.length}</p>
          <p className="text-xs text-gray-500 mt-1">🚗 Voitures</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
          <p className="text-3xl font-bold text-green-500">{withGps.length}</p>
          <p className="text-xs text-gray-500 mt-1">📍 Avec GPS</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, plaque..."
            className="w-full px-4 py-2.5 pl-10 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="flex bg-white border rounded-xl p-0.5">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'moto', label: '🏍️ Motos' },
            { id: 'car', label: '🚗 Voitures' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition ${
                filterType === f.id ? 'bg-brand-500 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Carte */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: '450px' }}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OSM'
          />
          <MapUpdater center={mapCenter} zoom={selected ? 16 : undefined} />

          {filtered.map(d => d.lat && d.lng && (
            <Marker
              key={d.id}
              position={[d.lat, d.lng]}
              icon={d.vehicle_type === 'car' ? carIcon : motoIcon}
            >
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <div className="flex items-center gap-2 mb-1">
                    {d.avatar && <img src={d.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />}
                    <div>
                      <p className="font-bold">{d.name}</p>
                      <p className="text-xs text-gray-400">{d.phone}</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {d.vehicle_type === 'moto' ? '🏍️' : '🚗'} {d.vehicle_info || d.vehicle_type}
                    {d.plate && ` · ${d.plate}`}
                  </p>
                  <p className="text-xs text-gray-500">⭐ {d.rating.toFixed(1)} · {d.total_rides} courses</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Chauffeur</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Véhicule</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Note</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Courses</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">GPS</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Mise à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">
                  {search ? 'Aucun résultat' : 'Aucun chauffeur en ligne'}
                </td></tr>
              ) : filtered.map(d => (
                <tr
                  key={d.id}
                  onClick={() => setSelected(selected?.id === d.id ? null : d)}
                  className={`hover:bg-gray-50 cursor-pointer transition ${selected?.id === d.id ? 'bg-brand-50 ring-1 ring-brand-200' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                        {d.avatar ? (
                          <img src={d.avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm">{d.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-gray-400">{d.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.vehicle_type === 'moto' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {d.vehicle_type === 'moto' ? '🏍️ Moto' : '🚗 Voiture'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm">
                      <Star size={12} className="text-yellow-400 fill-yellow-400" />
                      {d.rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{d.total_rides}</td>
                  <td className="px-4 py-3">
                    {d.lat ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Actif
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Pas de GPS</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{timeSince(d.last_update)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

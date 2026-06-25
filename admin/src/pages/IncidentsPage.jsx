import { useEffect, useState } from 'react'
import api from '../api/client'
import StatusBadge from '../components/ui/StatusBadge'

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadIncidents() }, [filter])

  const loadIncidents = async () => {
    setLoading(true)
    try {
      const params = filter ? `?status=${filter}` : ''
      const data = await api.get(`/admin/incidents${params}`)
      setIncidents(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const updateIncident = async (id, status, resolution = '') => {
    try {
      await api.patch(`/admin/incidents/${id}`, { status, resolution })
      loadIncidents()
    } catch (e) { alert(e.message) }
  }

  const typeLabels = {
    sos_emergency: '🚨 SOS',
    dispute: '⚖️ Litige',
    driver_behavior: '🚗 Chauffeur',
    passenger_behavior: '👤 Passager',
    accident: '💥 Accident',
    payment_issue: '💳 Paiement',
    other: '❓ Autre',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Incidents</h2>
        <div className="flex gap-1">
          {['', 'open', 'investigating', 'resolved', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                filter === s ? 'bg-primary text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s || 'Tous'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : incidents.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border">Aucun incident</div>
        ) : incidents.map(inc => (
          <div key={inc.id} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{typeLabels[inc.incident_type] || inc.incident_type}</span>
                  <StatusBadge status={inc.status} />
                  <StatusBadge status={inc.priority} />
                </div>
                <p className="text-sm text-gray-700">{inc.description}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-400">
                  <span>Par : {inc.reported_by_name}</span>
                  {inc.ride_id && <span>Course : {inc.ride_id?.slice(0, 8)}</span>}
                  <span>{new Date(inc.created_at).toLocaleDateString('fr')}</span>
                </div>
                {inc.resolution && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-800">
                    Résolution : {inc.resolution}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {inc.status === 'open' && (
                  <button
                    onClick={() => updateIncident(inc.id, 'investigating')}
                    className="px-3 py-1 text-xs bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100"
                  >
                    Investiguer
                  </button>
                )}
                {(inc.status === 'open' || inc.status === 'investigating') && (
                  <button
                    onClick={() => {
                      const resolution = prompt('Résolution :')
                      if (resolution) updateIncident(inc.id, 'resolved', resolution)
                    }}
                    className="px-3 py-1 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                  >
                    Résoudre
                  </button>
                )}
                {inc.status === 'resolved' && (
                  <button
                    onClick={() => updateIncident(inc.id, 'closed')}
                    className="px-3 py-1 text-xs bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    Fermer
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

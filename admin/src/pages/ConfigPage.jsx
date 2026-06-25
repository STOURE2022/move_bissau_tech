import { useEffect, useState } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import api from '../api/client'

export default function ConfigPage() {
  const [configs, setConfigs] = useState([])
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadConfigs() }, [])

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const data = await api.get('/admin/config')
      setConfigs(data)
      // Initialiser les valeurs éditables
      const values = {}
      data.forEach(c => { values[c.key] = JSON.stringify(c.value) })
      setEditValues(values)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const saveConfig = async (key) => {
    setSaving(key)
    try {
      let value = editValues[key]
      // Essayer de parser en nombre/booléen
      try { value = JSON.parse(value) } catch { /* garder comme string */ }
      await api.patch(`/admin/config/${key}`, { value })
      loadConfigs()
    } catch (e) { alert(e.message) }
    setSaving(null)
  }

  // Grouper par catégorie
  const grouped = configs.reduce((acc, c) => {
    const cat = c.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(c)
    return acc
  }, {})

  const categoryLabels = {
    location: '📍 Localisation / Pays',
    pricing: '💵 Tarification',
    commission: '💰 Commission',
    cancellation: '🚫 Annulation',
    matching: '🔍 Matching',
    rating: '⭐ Notation',
    general: '⚙️ Général',
  }

  // Ordre d'affichage des catégories
  const categoryOrder = Object.keys(categoryLabels)

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Configuration système</h2>
        <button
          onClick={loadConfigs}
          className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"
        >
          <RefreshCw size={16} />
          Recharger
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Les modifications prennent effet sous 5 minutes (cache Redis).
      </p>

      {categoryOrder
        .filter(cat => grouped[cat])
        .concat(Object.keys(grouped).filter(cat => !categoryOrder.includes(cat)))
        .filter(cat => grouped[cat])
        .map(category => [category, grouped[category]])
        .map(([category, items]) => (
        <div key={category} className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold">{categoryLabels[category] || category}</h3>
          </div>
          <div className="divide-y">
            {items.map(config => (
              <div key={config.key} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium text-gray-800">{config.key}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValues[config.key] || ''}
                    onChange={e => setEditValues(prev => ({ ...prev, [config.key]: e.target.value }))}
                    className="w-32 px-3 py-1.5 border rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <button
                    onClick={() => saveConfig(config.key)}
                    disabled={saving === config.key}
                    className="p-2 rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50 transition"
                    title="Sauvegarder"
                  >
                    <Save size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

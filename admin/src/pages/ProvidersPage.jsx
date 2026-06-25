import { useEffect, useState } from 'react'
import { Save, Eye, EyeOff } from 'lucide-react'
import api from '../api/client'
import StatusBadge from '../components/ui/StatusBadge'

export default function ProvidersPage() {
  const [paymentProviders, setPaymentProviders] = useState([])
  const [smsProviders, setSmsProviders] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingPayment, setEditingPayment] = useState(null)
  const [editingSms, setEditingSms] = useState(null)
  const [showSecrets, setShowSecrets] = useState({})

  useEffect(() => { loadProviders() }, [])

  const loadProviders = async () => {
    setLoading(true)
    try {
      const [payment, sms] = await Promise.all([
        api.get('/admin/payment-providers'),
        api.get('/admin/sms-providers'),
      ])
      setPaymentProviders(payment)
      setSmsProviders(sms)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const savePaymentProvider = async (id, data) => {
    try {
      await api.patch(`/admin/payment-providers/${id}`, data)
      loadProviders()
      setEditingPayment(null)
    } catch (e) { alert(e.message) }
  }

  const saveSmsProvider = async (id, data) => {
    try {
      await api.patch(`/admin/sms-providers/${id}`, data)
      loadProviders()
      setEditingSms(null)
    } catch (e) { alert(e.message) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Providers</h2>

      {/* === Paiement === */}
      <section>
        <h3 className="text-lg font-semibold mb-4">💳 Providers de paiement</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {paymentProviders.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-sm">
                    {p.name === 'orange_money' ? 'OM' : 'MV'}
                  </div>
                  <div>
                    <h4 className="font-semibold">{p.display_name}</h4>
                    <p className="text-xs text-gray-400">{p.provider_type}</p>
                  </div>
                </div>
                <StatusBadge status={p.is_active ? 'active' : 'inactive'} />
              </div>

              {editingPayment === p.id ? (
                <PaymentProviderForm
                  provider={p}
                  onSave={(data) => savePaymentProvider(p.id, data)}
                  onCancel={() => setEditingPayment(null)}
                />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">URL API</span>
                    <span className="font-mono text-xs">{p.api_base_url || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Merchant ID</span>
                    <span>{p.merchant_id || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Montants</span>
                    <span>{p.min_amount} — {p.max_amount} F</span>
                  </div>
                  <button
                    onClick={() => setEditingPayment(p.id)}
                    className="w-full mt-3 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100"
                  >
                    Modifier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* === SMS === */}
      <section>
        <h3 className="text-lg font-semibold mb-4">📱 Providers SMS</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {smsProviders.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold">{p.display_name}</h4>
                  <div className="flex gap-2 mt-1">
                    <StatusBadge status={p.is_active ? 'active' : 'inactive'} />
                    {p.is_primary && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Principal
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {editingSms === p.id ? (
                <SmsProviderForm
                  provider={p}
                  onSave={(data) => saveSmsProvider(p.id, data)}
                  onCancel={() => setEditingSms(null)}
                />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sender ID</span>
                    <span>{p.sender_id || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Coût/SMS</span>
                    <span>{p.cost_per_sms ? `$${p.cost_per_sms}` : '—'}</span>
                  </div>
                  <button
                    onClick={() => setEditingSms(p.id)}
                    className="w-full mt-3 px-3 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm hover:bg-gray-100"
                  >
                    Modifier
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// === Formulaire provider paiement ===
function PaymentProviderForm({ provider, onSave, onCancel }) {
  const [form, setForm] = useState({
    is_active: provider.is_active,
    api_base_url: provider.api_base_url || '',
    api_key: '',
    api_secret: '',
    merchant_id: provider.merchant_id || '',
    callback_url: provider.callback_url || '',
    min_amount: provider.min_amount,
    max_amount: provider.max_amount,
  })

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = () => {
    const data = { ...form }
    if (!data.api_key) delete data.api_key
    if (!data.api_secret) delete data.api_secret
    onSave(data)
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)} />
        <span className="text-sm">Actif</span>
      </label>
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="URL API"
        value={form.api_base_url} onChange={e => update('api_base_url', e.target.value)} />
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Clé API (laisser vide si inchangée)"
        value={form.api_key} onChange={e => update('api_key', e.target.value)} type="password" />
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Secret API (laisser vide si inchangé)"
        value={form.api_secret} onChange={e => update('api_secret', e.target.value)} type="password" />
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Merchant ID"
        value={form.merchant_id} onChange={e => update('merchant_id', e.target.value)} />
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Callback URL"
        value={form.callback_url} onChange={e => update('callback_url', e.target.value)} />
      <div className="flex gap-2">
        <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Min (F)" type="number"
          value={form.min_amount} onChange={e => update('min_amount', Number(e.target.value))} />
        <input className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Max (F)" type="number"
          value={form.max_amount} onChange={e => update('max_amount', Number(e.target.value))} />
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={handleSave}
          className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark">
          Sauvegarder
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </div>
  )
}

// === Formulaire provider SMS ===
function SmsProviderForm({ provider, onSave, onCancel }) {
  const [form, setForm] = useState({
    is_active: provider.is_active,
    is_primary: provider.is_primary,
    api_key: '',
    api_secret: '',
    sender_id: provider.sender_id || 'MoveBissau',
  })

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = () => {
    const data = { ...form }
    if (!data.api_key) delete data.api_key
    if (!data.api_secret) delete data.api_secret
    onSave(data)
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)} />
        <span className="text-sm">Actif</span>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.is_primary} onChange={e => update('is_primary', e.target.checked)} />
        <span className="text-sm">Provider principal</span>
      </label>
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Clé API"
        value={form.api_key} onChange={e => update('api_key', e.target.value)} type="password" />
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Secret API"
        value={form.api_secret} onChange={e => update('api_secret', e.target.value)} type="password" />
      <input className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Sender ID"
        value={form.sender_id} onChange={e => update('sender_id', e.target.value)} />
      <div className="flex gap-2 pt-2">
        <button onClick={handleSave}
          className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark">
          Sauvegarder
        </button>
        <button onClick={onCancel}
          className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
          Annuler
        </button>
      </div>
    </div>
  )
}

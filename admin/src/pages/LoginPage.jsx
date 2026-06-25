import { useState } from 'react'

export default function LoginPage({ onLogin }) {
  const [phone, setPhone] = useState('+245')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const requestOtp = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      if (!res.ok) throw new Error('Erreur envoi OTP')
      setStep('otp')
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  const verifyOtp = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      })
      if (!res.ok) throw new Error('Code invalide')
      const data = await res.json()
      if (data.user.role !== 'admin') {
        throw new Error('Accès réservé aux administrateurs')
      }
      onLogin(data.access, data.refresh)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-bold">
            MB
          </div>
          <h1 className="text-2xl font-bold mt-4">MoveBissau Admin</h1>
          <p className="text-gray-500 mt-1">Tableau de bord d'administration</p>
        </div>

        {step === 'phone' ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-lg"
              placeholder="+245 XX XXX XXXX"
            />
            <button
              onClick={requestOtp}
              disabled={loading || phone.length < 8}
              className="w-full mt-4 bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 transition"
            >
              {loading ? 'Envoi...' : 'Envoyer le code'}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4 text-center">
              Code envoyé au {phone}
            </p>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              maxLength={6}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary text-center text-2xl tracking-widest"
              placeholder="000000"
            />
            <button
              onClick={verifyOtp}
              disabled={loading || code.length !== 6}
              className="w-full mt-4 bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-dark disabled:opacity-50 transition"
            >
              {loading ? 'Vérification...' : 'Vérifier'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full mt-2 text-gray-500 text-sm hover:text-gray-700"
            >
              Changer de numéro
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 text-red-600 text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  )
}

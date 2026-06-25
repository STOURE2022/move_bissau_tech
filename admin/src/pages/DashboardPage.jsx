import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Users, Car, Wallet, TrendingUp, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight, Activity, Zap } from 'lucide-react'
import api from '../api/client'

export default function DashboardPage() {
  const [kpi, setKpi] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadKpi() }, [days])

  const loadKpi = async () => {
    setLoading(true)
    try { setKpi(await api.get(`/admin/kpi/dashboard?days=${days}`)) }
    catch (e) { console.error(e) }
    setLoading(false)
  }

  if (loading || !kpi) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm mt-4">Chargement des statistiques...</p>
        </div>
      </div>
    )
  }

  const chartData = [
    { name: 'Complétées', value: kpi.rides.completed, fill: '#22c55e' },
    { name: 'Annulées', value: kpi.rides.cancelled, fill: '#ef4444' },
    { name: 'Expirées', value: kpi.rides.expired_requests, fill: '#9ca3af' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header avec filtre */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de votre plateforme</p>
        </div>
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {[
            { v: 7, l: '7j' },
            { v: 30, l: '30j' },
            { v: 90, l: '90j' },
          ].map(f => (
            <button
              key={f.v}
              onClick={() => setDays(f.v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                days === f.v
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* KPI principales — 4 cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Courses complétées"
          value={kpi.rides.completed}
          subtitle={`${kpi.rides.rides_per_day}/jour`}
          icon={Car}
          color="green"
          trend={kpi.rides.completion_rate > 50 ? 'up' : 'down'}
          trendLabel={`${kpi.rides.completion_rate}% taux`}
        />
        <KpiCard
          title="Revenus commission"
          value={`${(kpi.revenue.total_commission_xof || 0).toLocaleString()} F`}
          subtitle="Commission 15%"
          icon={Wallet}
          color="blue"
        />
        <KpiCard
          title="Chauffeurs actifs"
          value={kpi.users.online_drivers}
          subtitle={`${kpi.users.verified_drivers} vérifiés`}
          icon={Users}
          color="purple"
          alert={kpi.users.pending_verification > 0 ? `${kpi.users.pending_verification} en attente` : null}
        />
        <KpiCard
          title="Passagers"
          value={kpi.users.total_passengers}
          icon={Users}
          color="orange"
        />
      </div>

      {/* Deuxième ligne — 4 cartes secondaires */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniCard label="Prix moyen" value={`${kpi.revenue.avg_ride_price_xof || 0} F`} icon="💰" />
        <MiniCard label="Crédit total" value={`${(kpi.commission_credit.total_balance_xof || 0).toLocaleString()} F`} icon="🏦" />
        <MiniCard label="Rechargements" value={kpi.commission_credit.topups_count || 0} icon="🔄" />
        <MiniCard label="Sans offre" value={kpi.rides.expired_requests} icon="⚠️" />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Graphique barres — 3 colonnes */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900">Répartition des courses</h3>
              <p className="text-xs text-gray-400 mt-0.5">{days} derniers jours</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500" /> Complétées</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Annulées</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-400" /> Expirées</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barSize={48}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Résumé financier — 2 colonnes */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-1">Résumé financier</h3>
          <p className="text-xs text-gray-400 mb-6">{days} derniers jours</p>

          <div className="space-y-4">
            <FinancialRow
              label="Revenus totaux"
              value={`${(kpi.revenue.total_revenue_xof || 0).toLocaleString()} F`}
              color="text-gray-900"
              big
            />
            <div className="h-px bg-gray-100" />
            <FinancialRow
              label="Commission plateforme (15%)"
              value={`${(kpi.revenue.total_commission_xof || 0).toLocaleString()} F`}
              color="text-green-600"
            />
            <FinancialRow
              label="Rechargements crédit"
              value={`${(kpi.commission_credit.topups_total_xof || 0).toLocaleString()} F`}
              color="text-blue-600"
            />
            <FinancialRow
              label="Taux de complétion"
              value={`${kpi.rides.completion_rate}%`}
              color={kpi.rides.completion_rate >= 70 ? 'text-green-600' : 'text-orange-500'}
            />
            <div className="h-px bg-gray-100" />
            <FinancialRow
              label="Demandes sans offre"
              value={kpi.rides.expired_requests}
              color="text-red-500"
            />
            <FinancialRow
              label="Total demandes"
              value={kpi.rides.total_requests}
              color="text-gray-600"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// === Composants internes ===

function KpiCard({ title, value, subtitle, icon: Icon, color, trend, trendLabel, alert }) {
  const colors = {
    green:  { bg: 'bg-green-50', icon: 'text-green-600', border: 'border-green-100' },
    blue:   { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', border: 'border-orange-100' },
  }
  const c = colors[color] || colors.green

  return (
    <div className={`bg-white rounded-2xl border ${c.border} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={20} className={c.icon} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trendLabel}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center justify-between mt-1">
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        {alert && (
          <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
            {alert}
          </span>
        )}
      </div>
    </div>
  )
}

function MiniCard({ label, value, icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="font-bold text-gray-900 text-sm">{value}</p>
        <p className="text-[10px] text-gray-400">{label}</p>
      </div>
    </div>
  )
}

function FinancialRow({ label, value, color, big }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`${big ? 'text-lg font-bold' : 'text-sm font-semibold'} ${color}`}>{value}</span>
    </div>
  )
}

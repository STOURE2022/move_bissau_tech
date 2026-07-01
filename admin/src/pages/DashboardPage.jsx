import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Users, Car, Wallet, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Activity, Banknote, RefreshCw, ShieldCheck,
} from 'lucide-react'
import api from '../api/client'

const fmtF = (n) => (n || 0).toLocaleString('fr-FR')
const fmtDay = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

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

  const daily = kpi.daily || []
  const donutData = [
    { name: 'Complétées', value: kpi.rides.completed, fill: '#22c55e' },
    { name: 'Annulées', value: kpi.rides.cancelled, fill: '#ef4444' },
    { name: 'Sans offre', value: kpi.rides.expired_requests, fill: '#d1d5db' },
  ]
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0)

  const completionRate = kpi.rides.completion_rate || 0
  const verifiedPct = kpi.users.total_drivers > 0
    ? Math.round((kpi.users.verified_drivers / kpi.users.total_drivers) * 100) : 0
  const noOfferPct = kpi.rides.total_requests > 0
    ? Math.round((kpi.rides.expired_requests / kpi.rides.total_requests) * 100) : 0

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ===== En-tête ===== */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadKpi}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-600 hover:border-gray-300 transition shadow-sm"
            title="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            {[{ v: 7, l: '7 jours' }, { v: 30, l: '30 jours' }, { v: 90, l: '90 jours' }].map(f => (
              <button
                key={f.v}
                onClick={() => setDays(f.v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  days === f.v ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Rangée KPI ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Carte héro — revenus commission */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 via-green-600 to-emerald-600 p-5 text-white shadow-lg shadow-green-600/20">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full" />
          <div className="absolute -bottom-14 -right-2 w-28 h-28 bg-white/5 rounded-full" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <Wallet size={19} />
              </div>
              <span className="text-[11px] font-medium text-white/70 bg-white/10 px-2.5 py-1 rounded-full">
                {days} derniers jours
              </span>
            </div>
            <p className="text-white/70 text-xs font-medium mt-4">Revenus commission</p>
            <p className="text-[1.75rem] leading-tight font-extrabold tracking-tight">
              {fmtF(kpi.revenue.total_commission_xof)} <span className="text-base font-semibold text-white/70">F</span>
            </p>
            <p className="text-white/60 text-xs mt-1">
              sur {fmtF(kpi.revenue.total_revenue_xof)} F de volume total
            </p>
          </div>
        </div>

        <KpiCard
          title="Courses complétées"
          value={kpi.rides.completed}
          subtitle={`${kpi.rides.rides_per_day} par jour en moyenne`}
          icon={Car}
          color="emerald"
          trend={completionRate >= 50 ? 'up' : 'down'}
          trendLabel={`${completionRate}%`}
        />
        <KpiCard
          title="Chauffeurs"
          value={kpi.users.total_drivers}
          subtitle={`${kpi.users.online_drivers} en ligne · ${kpi.users.verified_drivers} vérifiés`}
          icon={ShieldCheck}
          color="blue"
          alert={kpi.users.pending_verification > 0 ? `${kpi.users.pending_verification} à vérifier` : null}
        />
        <KpiCard
          title="Passagers"
          value={kpi.users.total_passengers}
          subtitle={`${kpi.rides.total_requests} demandes sur la période`}
          icon={Users}
          color="violet"
        />
      </div>

      {/* ===== Graphiques ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activité quotidienne */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Activity size={16} className="text-green-600" />
                Activité quotidienne
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">Revenus et courses payées par jour</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Revenus (F)</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Courses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={daily} margin={{ top: 20, right: 4, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRides" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtDay}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis yAxisId="revenue" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="rides" orientation="right" hide />
              <Tooltip
                labelFormatter={fmtDay}
                formatter={(value, name) => [
                  name === 'revenue' ? `${fmtF(value)} F` : value,
                  name === 'revenue' ? 'Revenus' : 'Courses',
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
              />
              <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2.5} fill="url(#gradRevenue)" />
              <Area yAxisId="rides" type="monotone" dataKey="rides" stroke="#60a5fa" strokeWidth={2} fill="url(#gradRides)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut répartition */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900">Répartition des demandes</h3>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">{days} derniers jours</p>

          <div className="relative">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={donutTotal > 0 ? 3 : 0}
                  strokeWidth={0}
                >
                  {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Total au centre */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-extrabold text-gray-900">{donutTotal}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">demandes</p>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {donutData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                  {d.name}
                </span>
                <span className="font-semibold text-gray-900">
                  {d.value}
                  <span className="text-gray-400 font-normal text-xs ml-1.5">
                    {donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Finances + Santé ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Résumé financier */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <Banknote size={16} className="text-green-600" />
            Résumé financier
          </h3>
          <div className="space-y-3.5">
            <FinancialRow label="Volume des courses" value={`${fmtF(kpi.revenue.total_revenue_xof)} F`} color="text-gray-900" big />
            <div className="h-px bg-gray-100" />
            <FinancialRow label="Commission plateforme" value={`${fmtF(kpi.revenue.total_commission_xof)} F`} color="text-green-600" />
            <FinancialRow label="Prix moyen d'une course" value={`${fmtF(kpi.revenue.avg_ride_price_xof)} F`} color="text-gray-700" />
            <div className="h-px bg-gray-100" />
            <FinancialRow
              label={`Rechargements crédit (${kpi.commission_credit.topups_count || 0})`}
              value={`${fmtF(kpi.commission_credit.topups_total_xof)} F`}
              color="text-blue-600"
            />
            <FinancialRow label="Crédit en circulation" value={`${fmtF(kpi.commission_credit.total_balance_xof)} F`} color="text-gray-700" />
          </div>
        </div>

        {/* Santé de la plateforme */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-green-600" />
            Santé de la plateforme
          </h3>
          <div className="space-y-5">
            <HealthBar
              label="Taux de complétion"
              value={completionRate}
              display={`${completionRate}%`}
              color={completionRate >= 70 ? 'bg-green-500' : completionRate >= 40 ? 'bg-yellow-500' : 'bg-red-500'}
            />
            <HealthBar
              label="Chauffeurs vérifiés"
              value={verifiedPct}
              display={`${kpi.users.verified_drivers}/${kpi.users.total_drivers}`}
              color={verifiedPct >= 80 ? 'bg-green-500' : 'bg-yellow-500'}
            />
            <HealthBar
              label="Demandes sans offre"
              value={noOfferPct}
              display={`${kpi.rides.expired_requests} (${noOfferPct}%)`}
              color={noOfferPct <= 10 ? 'bg-green-500' : noOfferPct <= 30 ? 'bg-yellow-500' : 'bg-red-500'}
              invert
            />

            {kpi.users.pending_verification > 0 && (
              <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                <AlertTriangle size={15} className="text-orange-500 flex-shrink-0" />
                <p className="text-xs text-orange-700">
                  <strong>{kpi.users.pending_verification} chauffeur{kpi.users.pending_verification > 1 ? 's' : ''}</strong> en attente de vérification
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// === Composants internes ===

function KpiCard({ title, value, subtitle, icon: Icon, color, trend, trendLabel, alert }) {
  const colors = {
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50', icon: 'text-blue-600' },
    violet:  { bg: 'bg-violet-50', icon: 'text-violet-600' },
    orange:  { bg: 'bg-orange-50', icon: 'text-orange-600' },
  }
  const c = colors[color] || colors.emerald

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center`}>
          <Icon size={19} className={c.icon} />
        </div>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
            trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trendLabel}
          </span>
        )}
        {alert && (
          <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
            {alert}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-xs font-medium mt-4">{title}</p>
      <p className="text-[1.6rem] leading-tight font-extrabold text-gray-900 tracking-tight">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}

function FinancialRow({ label, value, color, big }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`${big ? 'text-xl font-extrabold' : 'text-sm font-semibold'} ${color}`}>{value}</span>
    </div>
  )
}

function HealthBar({ label, value, display, color }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{display}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

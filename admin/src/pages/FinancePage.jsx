import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, RotateCcw, ArrowDownCircle, Download, CreditCard, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import api from '../api/client'

const kpiCards = [
  { key: 'revenue',     label: 'Revenus bruts',       icon: DollarSign,      bg: 'bg-green-50',  iconBg: 'bg-green-100',  iconColor: 'text-green-600',  valueColor: 'text-green-700' },
  { key: 'commission',  label: 'Commissions nettes',  icon: TrendingUp,      bg: 'bg-blue-50',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-600',   valueColor: 'text-blue-700' },
  { key: 'refunds',     label: 'Remboursements',      icon: RotateCcw,       bg: 'bg-red-50',    iconBg: 'bg-red-100',    iconColor: 'text-red-600',     valueColor: 'text-red-700' },
  { key: 'withdrawals', label: 'Retraits',            icon: ArrowDownCircle, bg: 'bg-orange-50', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', valueColor: 'text-orange-700' },
]

const methodColors = {
  orange_money: { bg: 'bg-orange-500', label: 'Orange Money' },
  mtn_money:    { bg: 'bg-yellow-500', label: 'MTN Money' },
  cash:         { bg: 'bg-green-500',  label: 'Especes' },
  credit:       { bg: 'bg-blue-500',   label: 'Credit' },
  wallet:       { bg: 'bg-purple-500', label: 'Portefeuille' },
}

function formatNumber(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString('fr-FR')
}

export default function FinancePage() {
  const [summary, setSummary] = useState(null)
  const [daily, setDaily] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Export date range
  const [exportStart, setExportStart] = useState('')
  const [exportEnd, setExportEnd] = useState('')

  useEffect(() => { loadData() }, [days])

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, d] = await Promise.all([
        api.get(`/admin/finance/summary?days=${days}`),
        api.get(`/admin/finance/daily?days=${days}`),
      ])
      setSummary(s)
      setDaily(d)
    } catch {}
    setLoading(false)
  }

  const handleExport = async () => {
    if (!exportStart || !exportEnd) {
      alert('Veuillez selectionner les dates de debut et de fin.')
      return
    }
    setExporting(true)
    try {
      // Télécharger le CSV directement via fetch (pas via api.get qui parse en JSON)
      const token = localStorage.getItem('access_token')
      const res = await fetch(`/api/admin/finance/export?start=${exportStart}&end=${exportEnd}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Erreur export')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `finance_${exportStart}_${exportEnd}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      alert(e.message || "Erreur lors de l'export")
    }
    setExporting(false)
  }

  // KPI values from summary
  const getKpiValue = (key) => {
    if (!summary) return 0
    switch (key) {
      case 'revenue': return summary.rides?.total_revenue || 0
      case 'commission': return summary.rides?.net_commission || 0
      case 'refunds': return summary.refunds?.total_refunded || 0
      case 'withdrawals': return summary.withdrawals?.total_withdrawn || 0
      default: return 0
    }
  }

  const getKpiSub = (key) => {
    if (!summary) return ''
    switch (key) {
      case 'revenue': return `${summary.rides?.paid_count || 0} courses payees`
      case 'commission': return `Commission totale : ${formatNumber(summary.rides?.total_commission)} F`
      case 'refunds': return `${summary.refunds?.pending || 0} en attente / ${summary.refunds?.processed || 0} traites`
      case 'withdrawals': return `${summary.withdrawals?.pending || 0} en attente / ${summary.withdrawals?.completed || 0} effectues`
      default: return ''
    }
  }

  // Chart max for daily bars
  const dailyData = daily?.daily || []
  const maxRevenue = Math.max(...dailyData.map(d => d.revenue || 0), 1)

  // Payment methods
  const byMethod = daily?.by_method || []
  const totalMethodAmount = byMethod.reduce((sum, m) => sum + (m.total || 0), 0) || 1

  // Recent transactions
  const transactions = daily?.transactions || []

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-gray-900">Finance</h2>
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          {[
            { v: 7, l: '7j' },
            { v: 30, l: '30j' },
            { v: 90, l: '90j' },
          ].map(p => (
            <button
              key={p.v}
              onClick={() => setDays(p.v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                days === p.v ? 'bg-green-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map(card => {
              const Icon = card.icon
              return (
                <div key={card.key} className={`${card.bg} rounded-2xl border border-gray-200 p-5`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center`}>
                      <Icon size={20} className={card.iconColor} />
                    </div>
                    <p className="text-sm font-medium text-gray-600">{card.label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${card.valueColor}`}>{formatNumber(getKpiValue(card.key))} F</p>
                  <p className="text-xs text-gray-500 mt-1">{getKpiSub(card.key)}</p>
                </div>
              )
            })}
          </div>

          {/* Revenue Chart + Payment Methods */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Daily Revenue Chart */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-800 mb-4">Revenus journaliers</h3>
              {dailyData.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <p>Aucune donnee pour cette periode</p>
                </div>
              ) : (
                <div className="flex items-end gap-1 h-48">
                  {dailyData.map((d, i) => {
                    const height = Math.max((d.revenue / maxRevenue) * 100, 2)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end group relative">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                            <p className="font-semibold">{formatNumber(d.revenue)} F</p>
                            <p className="text-gray-400">{d.rides || 0} courses</p>
                            <p className="text-gray-400">{new Date(d.date).toLocaleDateString('fr', { day: 'numeric', month: 'short' })}</p>
                          </div>
                        </div>
                        {/* Bar */}
                        <div
                          className="w-full bg-green-400 hover:bg-green-500 rounded-t-sm transition-colors cursor-pointer"
                          style={{ height: `${height}%`, minHeight: '2px' }}
                        />
                        {/* Date label - show every nth */}
                        {(i === 0 || i === dailyData.length - 1 || (dailyData.length <= 14 && i % 2 === 0) || (dailyData.length > 14 && i % 7 === 0)) && (
                          <p className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">
                            {new Date(d.date).toLocaleDateString('fr', { day: 'numeric', month: 'short' })}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Payment Methods */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="font-bold text-gray-800 mb-4">Methodes de paiement</h3>
              {byMethod.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <p>Aucune donnee</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {byMethod.map((m, i) => {
                    const pct = Math.round((m.total / totalMethodAmount) * 100)
                    const colorConfig = methodColors[m.method] || { bg: 'bg-gray-500', label: m.method }
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${colorConfig.bg}`} />
                            <span className="text-sm font-medium text-gray-700">{colorConfig.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-800">{formatNumber(m.total)} F</span>
                            <span className="text-xs text-gray-400 ml-2">({pct}%)</span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${colorConfig.bg} rounded-full transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{m.count || 0} transactions</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions + Export */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Transactions */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Transactions recentes</h3>
              </div>
              {transactions.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
                  <p>Aucune transaction</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="text-left px-5 py-3">Transaction</th>
                      <th className="text-left px-5 py-3">Methode</th>
                      <th className="text-right px-5 py-3">Montant</th>
                      <th className="text-right px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.slice(0, 20).map((t, i) => {
                      const isPositive = t.amount > 0
                      const isNegative = t.amount < 0
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isPositive ? 'bg-green-50' : isNegative ? 'bg-red-50' : 'bg-gray-50'
                              }`}>
                                {isPositive ? (
                                  <ArrowUpRight size={16} className="text-green-500" />
                                ) : isNegative ? (
                                  <ArrowDownRight size={16} className="text-red-500" />
                                ) : (
                                  <Minus size={16} className="text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-800">{t.label || t.type}</p>
                                {t.commission != null && t.commission > 0 && (
                                  <p className="text-xs text-gray-400">Commission : {formatNumber(t.commission)} F</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className="text-sm text-gray-600">{t.method || '—'}</span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-sm font-bold ${
                              isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {isPositive ? '+' : ''}{formatNumber(t.amount)} F
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-gray-400">
                            {new Date(t.date).toLocaleDateString('fr', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Export CSV */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 self-start sticky top-24">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <Download size={20} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Export CSV</h3>
                  <p className="text-xs text-gray-500">Telecharger les donnees financieres</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Date de debut</label>
                  <input
                    type="date"
                    value={exportStart}
                    onChange={e => setExportStart(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">Date de fin</label>
                  <input
                    type="date"
                    value={exportEnd}
                    onChange={e => setExportEnd(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
                  />
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={exporting || !exportStart || !exportEnd}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                {exporting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Download size={16} /> Exporter en CSV
                  </>
                )}
              </button>

              {/* Quick stats */}
              {summary && (
                <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Resume rapide</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Courses payees</span>
                    <span className="font-semibold text-gray-800">{summary.rides?.paid_count || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Recharges</span>
                    <span className="font-semibold text-gray-800">{summary.topups?.count || 0} ({formatNumber(summary.topups?.total)} F)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Rembours. en attente</span>
                    <span className="font-semibold text-yellow-600">{summary.refunds?.pending || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Retraits en attente</span>
                    <span className="font-semibold text-yellow-600">{summary.withdrawals?.pending || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

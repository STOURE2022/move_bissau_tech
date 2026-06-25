import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCheck, Car, MapPin, AlertTriangle,
  Settings, CreditCard, LogOut, Menu, X, Bell, Search, ChevronRight,
  RefreshCw, Banknote, TrendingUp
} from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../../api/client'

const navSections = [
  {
    label: 'Principal',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/passengers', icon: Users, label: 'Passagers' },
      { to: '/drivers', icon: UserCheck, label: 'Chauffeurs', badge: 'pending' },
      { to: '/rides', icon: Car, label: 'Courses' },
      { to: '/rides/live', icon: MapPin, label: 'Temps réel' },
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance', icon: TrendingUp, label: 'Vue financière' },
      { to: '/refunds', icon: RefreshCw, label: 'Remboursements', badge: 'refunds' },
      { to: '/withdrawals', icon: Banknote, label: 'Retraits', badge: 'withdrawals' },
    ]
  },
  {
    label: 'Gestion',
    items: [
      { to: '/incidents', icon: AlertTriangle, label: 'Incidents', badge: 'incidents' },
      { to: '/config', icon: Settings, label: 'Configuration' },
      { to: '/providers', icon: CreditCard, label: 'Providers' },
    ]
  }
]

const pageNames = {
  '/': 'Dashboard',
  '/passengers': 'Gestion des passagers',
  '/drivers': 'Gestion des chauffeurs',
  '/rides': 'Historique des courses',
  '/rides/live': 'Suivi en temps réel',
  '/incidents': 'Gestion des incidents',
  '/config': 'Configuration système',
  '/providers': 'Providers paiement & SMS',
  '/finance': 'Vue financière',
  '/refunds': 'Gestion des remboursements',
  '/withdrawals': 'Gestion des retraits',
}

export default function Layout({ children, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [badges, setBadges] = useState({ pending: 0, incidents: 0 })
  const location = useLocation()

  // Charger les compteurs de badges
  useEffect(() => {
    const loadBadges = async () => {
      try {
        const [drivers, incidents, refunds, withdrawals] = await Promise.all([
          api.get('/admin/drivers?verification_status=pending').catch(() => []),
          api.get('/admin/incidents?status=open').catch(() => []),
          api.get('/admin/refunds?status=pending').catch(() => []),
          api.get('/admin/withdrawals?status=pending').catch(() => []),
        ])
        setBadges({
          pending: Array.isArray(drivers) ? drivers.length : 0,
          incidents: Array.isArray(incidents) ? incidents.length : 0,
          refunds: Array.isArray(refunds) ? refunds.length : 0,
          withdrawals: Array.isArray(withdrawals) ? withdrawals.length : 0,
        })
      } catch {}
    }
    loadBadges()
    const interval = setInterval(loadBadges, 30000) // Rafraîchir toutes les 30s
    return () => clearInterval(interval)
  }, [])

  const currentPage = pageNames[location.pathname] || 'Administration'

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* === Sidebar === */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-gray-200 transform transition-transform duration-300
        lg:translate-x-0 lg:static lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
              MB
            </div>
            <div>
              <span className="text-base font-bold text-gray-900">MoveBissau</span>
              <p className="text-[10px] text-gray-400 -mt-0.5">Administration</p>
            </div>
          </div>
          <button className="lg:hidden p-1 rounded-lg hover:bg-gray-100" onClick={() => setSidebarOpen(false)}>
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {navSections.map(section => (
            <div key={section.label} className="mb-6">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(item => {
                  const badgeCount = item.badge ? badges[item.badge] : 0
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) => `
                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200
                        ${isActive
                          ? 'bg-green-50 text-green-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }
                      `}
                    >
                      <item.icon size={18} strokeWidth={1.8} />
                      <span className="flex-1">{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {badgeCount}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bas de sidebar */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 w-full transition-all"
          >
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* === Contenu principal === */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 rounded-xl hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} className="text-gray-700" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{currentPage}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-xl hover:bg-gray-100 transition">
              <Bell size={20} className="text-gray-500" />
              {(badges.pending + badges.incidents) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badges.pending + badges.incidents}
                </span>
              )}
            </button>

            {/* Avatar admin */}
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center text-white text-xs font-bold ml-1">
              A
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

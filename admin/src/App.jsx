import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import api from './api/client'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DriversPage from './pages/DriversPage'
import RidesPage from './pages/RidesPage'
import RidesLivePage from './pages/RidesLivePage'
import IncidentsPage from './pages/IncidentsPage'
import ConfigPage from './pages/ConfigPage'
import ProvidersPage from './pages/ProvidersPage'
import PassengersPage from './pages/PassengersPage'
import RefundsPage from './pages/RefundsPage'
import WithdrawalsPage from './pages/WithdrawalsPage'
import FinancePage from './pages/FinancePage'

export default function App() {
  const [isAuth, setIsAuth] = useState(api.isAuthenticated)

  const handleLogin = (access, refresh) => {
    api.setTokens(access, refresh)
    setIsAuth(true)
  }

  const handleLogout = () => {
    api.clearTokens()
    setIsAuth(false)
  }

  if (!isAuth) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <Layout onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/passengers" element={<PassengersPage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/rides" element={<RidesPage />} />
        <Route path="/rides/live" element={<RidesLivePage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/refunds" element={<RefundsPage />} />
        <Route path="/withdrawals" element={<WithdrawalsPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

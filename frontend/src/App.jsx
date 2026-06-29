import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

// Auth
import WelcomePage from './pages/auth/WelcomePage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import OtpPage from './pages/auth/OtpPage';
import CompleteProfilePage from './pages/auth/CompleteProfilePage';

// Passager
import HomePage from './pages/passenger/HomePage';
import RequestPage from './pages/passenger/RequestPage';
import OffersPage from './pages/passenger/OffersPage';
import MyRidesPage from './pages/passenger/MyRidesPage';
import PassengerNav from './components/layout/PassengerNav';
import TrackingPage from './pages/passenger/TrackingPage';
import PaymentPage from './pages/passenger/PaymentPage';
import PassengerProfilePage from './pages/passenger/PassengerProfilePage';

// Chauffeur
import DriverHomePage from './pages/driver/DriverHomePage';
import CreditPage from './pages/driver/CreditPage';
import DriverProfilePage from './pages/driver/DriverProfilePage';
import DriverHistoryPage from './pages/driver/DriverHistoryPage';
import DriverSetupPage from './pages/driver/DriverSetupPage';
import DriverRidePage from './pages/driver/DriverRidePage';

// Commun
import RatePage from './pages/common/RatePage';
import HistoryPage from './pages/common/HistoryPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to={localStorage.getItem('mb_welcomed') ? '/login' : '/welcome'} />;
  }
  return children;
}

// Route réservée aux passagers (+ admin)
function PassengerRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role === 'driver') return <Navigate to="/driver" />;
  return children;
}

// Route réservée aux chauffeurs (+ admin)
function DriverRoute({ children }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role === 'passenger') return <Navigate to="/" />;
  return children;
}

export default function App() {
  const { isAuthenticated, user } = useAuth();
  const isDriver = user?.role === 'driver';
  const showPassengerNav = isAuthenticated && !isDriver;

  return (
    <>
    {showPassengerNav && <PassengerNav />}
    <Routes>
      {/* Auth — redirige vers home si déjà connecté */}
      <Route path="/welcome" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <WelcomePage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <RegisterPage />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <ForgotPasswordPage />} />
      <Route path="/otp" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <OtpPage />} />
      <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfilePage /></ProtectedRoute>} />

      {/* Passager — interdit aux chauffeurs */}
      <Route path="/" element={<PassengerRoute><HomePage /></PassengerRoute>} />
      <Route path="/my-rides" element={<PassengerRoute><MyRidesPage /></PassengerRoute>} />
      <Route path="/request" element={<PassengerRoute><RequestPage /></PassengerRoute>} />
      <Route path="/offers/:requestId" element={<PassengerRoute><OffersPage /></PassengerRoute>} />
      <Route path="/tracking/:rideId" element={<PassengerRoute><TrackingPage /></PassengerRoute>} />
      <Route path="/payment/:rideId" element={<PassengerRoute><PaymentPage /></PassengerRoute>} />

      {/* Chauffeur — interdit aux passagers */}
      <Route path="/driver" element={<DriverRoute><DriverHomePage /></DriverRoute>} />
      <Route path="/driver/credit" element={<DriverRoute><CreditPage /></DriverRoute>} />
      <Route path="/driver/profile" element={<DriverRoute><DriverProfilePage /></DriverRoute>} />
      <Route path="/driver/history" element={<DriverRoute><DriverHistoryPage /></DriverRoute>} />
      <Route path="/driver/setup" element={<DriverRoute><DriverSetupPage /></DriverRoute>} />
      <Route path="/driver/ride/:rideId" element={<DriverRoute><DriverRidePage /></DriverRoute>} />

      {/* Commun — tous les rôles */}
      <Route path="/rate/:rideId" element={<ProtectedRoute><RatePage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><PassengerProfilePage /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={
        <Navigate to={
          isAuthenticated
            ? (isDriver ? '/driver' : '/')
            : (localStorage.getItem('mb_welcomed') ? '/login' : '/welcome')
        } />
      } />
    </Routes>
    </>
  );
}

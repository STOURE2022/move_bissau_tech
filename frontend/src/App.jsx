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

export default function App() {
  const { isAuthenticated, isDriver } = useAuth();

  return (
    <>
    {isAuthenticated && !isDriver && <PassengerNav />}
    <Routes>
      {/* Auth — redirige vers home si déjà connecté */}
      <Route path="/welcome" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <WelcomePage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <RegisterPage />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <ForgotPasswordPage />} />
      <Route path="/otp" element={isAuthenticated ? <Navigate to={isDriver ? '/driver' : '/'} /> : <OtpPage />} />
      <Route path="/complete-profile" element={<CompleteProfilePage />} />

      {/* Passager */}
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/my-rides" element={<ProtectedRoute><MyRidesPage /></ProtectedRoute>} />
      <Route path="/request" element={<ProtectedRoute><RequestPage /></ProtectedRoute>} />
      <Route path="/offers/:requestId" element={<ProtectedRoute><OffersPage /></ProtectedRoute>} />
      <Route path="/tracking/:rideId" element={<ProtectedRoute><TrackingPage /></ProtectedRoute>} />
      <Route path="/payment/:rideId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />

      {/* Chauffeur */}
      <Route path="/driver" element={<ProtectedRoute><DriverHomePage /></ProtectedRoute>} />
      <Route path="/driver/credit" element={<ProtectedRoute><CreditPage /></ProtectedRoute>} />
      <Route path="/driver/profile" element={<ProtectedRoute><DriverProfilePage /></ProtectedRoute>} />
      <Route path="/driver/history" element={<ProtectedRoute><DriverHistoryPage /></ProtectedRoute>} />
      <Route path="/driver/setup" element={<ProtectedRoute><DriverSetupPage /></ProtectedRoute>} />
      <Route path="/driver/ride/:rideId" element={<ProtectedRoute><DriverRidePage /></ProtectedRoute>} />

      {/* Commun */}
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

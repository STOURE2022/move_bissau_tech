import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import { CountryProvider } from './hooks/useCountryConfig';
import { ToastProvider } from './components/ui/Toast';
import OfflineBanner from './components/ui/OfflineBanner';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CountryProvider>
      <AuthProvider>
        <ToastProvider>
          <OfflineBanner />
          <App />
        </ToastProvider>
      </AuthProvider>
      </CountryProvider>
    </BrowserRouter>
  </React.StrictMode>
);

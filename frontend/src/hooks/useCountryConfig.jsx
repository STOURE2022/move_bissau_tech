import { createContext, useContext, useState, useEffect } from 'react';

const DEFAULTS = {
  country_code: 'gw',
  country_name: 'Guinée-Bissau',
  country_flag: '🇬🇼',
  phone_prefix: '+245',
  default_lat: 11.8636,
  default_lng: -15.5977,
  default_zoom: 15,
  currency: 'XOF',
  currency_symbol: 'F CFA',
};

const CountryContext = createContext(DEFAULTS);

export function CountryProvider({ children }) {
  const [config, setConfig] = useState(() => {
    // Charger depuis le cache localStorage d'abord
    try {
      const cached = JSON.parse(localStorage.getItem('mb_country_config'));
      if (cached) return cached;
    } catch {}
    return DEFAULTS;
  });

  useEffect(() => {
    // Charger depuis l'API
    fetch('/api/config/country')
      .then(r => r.json())
      .then(data => {
        setConfig(data);
        localStorage.setItem('mb_country_config', JSON.stringify(data));
      })
      .catch(() => {});
  }, []);

  return (
    <CountryContext.Provider value={config}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountryConfig() {
  return useContext(CountryContext);
}

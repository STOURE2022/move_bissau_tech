import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Hook de géolocalisation réutilisable.
 *
 * @param {object} options
 * @param {boolean} options.watch - true = suivi continu (watchPosition), false = one-shot
 * @param {number} options.defaultLat - latitude par défaut
 * @param {number} options.defaultLng - longitude par défaut
 * @returns {{ position, accuracy, heading, speed, loading, error, locate, isTracking }}
 */
export function useGeolocation({ watch = false, defaultLat = 0, defaultLng = 0 } = {}) {
  const { t } = useTranslation();
  const [position, setPosition] = useState([defaultLat, defaultLng]);
  const [accuracy, setAccuracy] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const watchRef = useRef(null);

  const handleSuccess = useCallback((pos) => {
    setPosition([pos.coords.latitude, pos.coords.longitude]);
    setAccuracy(pos.coords.accuracy);
    setHeading(pos.coords.heading);
    setSpeed(pos.coords.speed);
    setLoading(false);
    setError(null);
    setIsTracking(true);
  }, []);

  const handleError = useCallback((err) => {
    setLoading(false);
    setIsTracking(false);
    if (err.code === 1) setError(t('geo.denied'));
    else if (err.code === 2) setError(t('geo.unavailable'));
    else if (err.code === 3) setError(t('geo.timeout'));
    else setError(t('geo.error'));
  }, [t]);

  const geoOptions = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000,
  };

  // Localisation initiale
  useEffect(() => {
    if (!navigator.geolocation) {
      setError(t('geo.unsupported'));
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);

    if (watch) {
      watchRef.current = navigator.geolocation.watchPosition(
        handleSuccess, handleError, geoOptions
      );
    }

    return () => {
      if (watchRef.current !== null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [watch]);

  // Recentrage manuel
  const locate = useCallback(() => {
    setLoading(true);
    navigator.geolocation?.getCurrentPosition(handleSuccess, handleError, geoOptions);
  }, [handleSuccess, handleError]);

  return { position, accuracy, heading, speed, loading, error, locate, isTracking };
}

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Route, User, Car, Receipt, Download } from 'lucide-react';
import { toPng } from 'html-to-image';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Reçu de course — affiché après paiement et dans l'historique.
 * Design inspiré des reçus Uber/InDrive.
 */
export default function RideReceipt({ ride, onClose, showActions = true }) {
  const { t, lang } = useTranslation();
  const receiptRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `MoveBissau-${lang === 'pt' ? 'Recibo' : 'Recu'}-${String(ride.id).slice(0, 8).toUpperCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Fallback: imprimer
      window.print();
    }
    setDownloading(false);
  };

  if (!ride) return null;

  const date = new Date(ride.created_at);
  const dateStr = date.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  const commission = ride.commission_amount || 0;
  const driverAmount = ride.agreed_price - commission;

  // Durée de la course
  let duration = '';
  if (ride.driver_assigned_at && (ride.completed_at || ride.paid_at)) {
    const start = new Date(ride.driver_assigned_at);
    const end = new Date(ride.completed_at || ride.paid_at);
    const diffMin = Math.round((end - start) / 60000);
    duration = diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`;
  }

  // Distance
  const distanceKm = ride.actual_distance_m
    ? `${(ride.actual_distance_m / 1000).toFixed(1)} km`
    : ride.estimated_distance_m
      ? `~${(ride.estimated_distance_m / 1000).toFixed(1)} km`
      : null;

  const receiptId = `MB-${String(ride.id).slice(0, 8).toUpperCase()}`;

  return (
    <motion.div
      ref={receiptRef}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-elevated overflow-hidden max-w-md mx-auto"
    >
      {/* Header vert */}
      <div className="bg-gradient-to-r from-brand-500 to-emerald-500 px-6 py-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt size={18} />
            <span className="text-sm font-medium opacity-80">{t('receipt.title', 'Reçu de course')}</span>
          </div>
          <span className="text-xs opacity-70 font-mono">{receiptId}</span>
        </div>
        <p className="text-3xl font-extrabold">{ride.agreed_price} {t('common.fcfa', 'F CFA')}</p>
        <p className="text-sm opacity-80 mt-1">{dateStr} {t('receipt.at', 'à')} {timeStr}</p>
      </div>

      {/* Trajet */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-brand-500 border-2 border-white shadow" />
            <div className="w-0.5 h-8 bg-gray-200 my-1" />
            <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs text-gray-400">{t('receipt.departure', 'Départ')}</p>
              <p className="text-sm font-medium text-gray-800 line-clamp-1">{ride.pickup_address || 'GPS'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">{t('receipt.arrival', 'Arrivée')}</p>
              <p className="text-sm font-medium text-gray-800 line-clamp-1">{ride.dropoff_address || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 py-3 flex gap-4 border-b border-gray-100">
        {distanceKm && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Route size={14} />
            <span>{distanceKm}</span>
          </div>
        )}
        {duration && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock size={14} />
            <span>{duration}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Car size={14} />
          <span>{(ride.driver_vehicle?.type || ride.vehicle_type) === 'car' ? t('passenger.car', 'Voiture') : t('passenger.motoTaxi', 'Moto-taxi')}</span>
        </div>
      </div>

      {/* Détails prix */}
      <div className="px-6 py-4 space-y-2 border-b border-gray-100">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">{t('receipt.agreedPrice', 'Prix convenu')}</span>
          <span className="font-medium">{ride.agreed_price} F</span>
        </div>
        {ride.cancellation_fee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('receipt.cancellationFee', "Frais d'annulation")}</span>
            <span className="font-medium text-red-600">{ride.cancellation_fee} F</span>
          </div>
        )}
        <div className="flex justify-between text-sm pt-2 border-t border-dashed border-gray-200">
          <span className="font-bold text-gray-800">{t('receipt.totalPaid', 'Total payé')}</span>
          <span className="font-bold text-brand-600">{ride.agreed_price} {t('common.fcfa', 'F CFA')}</span>
        </div>
      </div>

      {/* Chauffeur / Passager */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
            <User size={18} className="text-gray-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">
              {ride.driver_name || ride.passenger_name || '—'}
            </p>
            {ride.driver_vehicle && (
              <p className="text-xs text-gray-400">
                {ride.driver_vehicle.brand} {ride.driver_vehicle.model}
                {ride.driver_vehicle.plate && ` · ${ride.driver_vehicle.plate}`}
              </p>
            )}
          </div>
          {ride.driver_rating > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-yellow-400">⭐</span>
              <span className="text-sm font-medium">{Number(ride.driver_rating).toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 text-center">
        <p className="text-[10px] text-gray-300">{t('receipt.companyName', 'MoveBissau Technologies')}</p>
        {showActions && (
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={downloadReceipt}
              disabled={downloading}
              className="flex items-center gap-1.5 text-sm text-brand-500 font-medium hover:text-brand-600 disabled:opacity-50"
            >
              <Download size={14} />
              {downloading ? '...' : t('receipt.download', 'Télécharger')}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-sm text-gray-400 font-medium hover:text-gray-600"
              >
                {t('common.close', 'Fermer')}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

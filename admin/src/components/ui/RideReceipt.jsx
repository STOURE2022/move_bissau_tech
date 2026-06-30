import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';

/**
 * Reçu de course pour l'admin — téléchargeable en PNG.
 */
export default function RideReceipt({ ride, onClose }) {
  const receiptRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!ride) return null;

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `MoveBissau-Recu-${String(ride.id).slice(0, 8).toUpperCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      window.print();
    }
    setDownloading(false);
  };

  const date = new Date(ride.created_at);
  const dateStr = date.toLocaleDateString('fr', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' });
  const receiptId = `MB-${String(ride.id).slice(0, 8).toUpperCase()}`;
  const vehicleLabel = (ride.driver_vehicle?.type || ride.vehicle_type) === 'car' ? 'Voiture' : 'Moto-taxi';

  let duration = '';
  if (ride.driver_assigned_at && (ride.completed_at || ride.paid_at)) {
    const start = new Date(ride.driver_assigned_at);
    const end = new Date(ride.completed_at || ride.paid_at);
    const diffMin = Math.round((end - start) / 60000);
    duration = diffMin < 60 ? `${diffMin} min` : `${Math.floor(diffMin / 60)}h ${diffMin % 60}min`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-w-md w-full">
        <div ref={receiptRef} className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-emerald-500 px-6 py-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium opacity-80">Reçu de course</span>
              <span className="text-xs opacity-70 font-mono">{receiptId}</span>
            </div>
            <p className="text-3xl font-extrabold">{ride.agreed_price} F CFA</p>
            <p className="text-sm opacity-80 mt-1">{dateStr} à {timeStr}</p>
          </div>

          {/* Trajet */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-primary border-2 border-white shadow" />
                <div className="w-0.5 h-8 bg-gray-200 my-1" />
                <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs text-gray-400">Départ</p>
                  <p className="text-sm font-medium text-gray-800">{ride.pickup_address || 'Position GPS'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Arrivée</p>
                  <p className="text-sm font-medium text-gray-800">{ride.dropoff_address || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="px-6 py-3 flex gap-4 border-b border-gray-100 text-xs text-gray-500">
            {duration && <span>⏱ {duration}</span>}
            <span>🚘 {vehicleLabel}</span>
          </div>

          {/* Détails prix */}
          <div className="px-6 py-4 space-y-2 border-b border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Prix convenu</span>
              <span className="font-medium">{ride.agreed_price} F</span>
            </div>
            {Number(ride.commission_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Commission ({ride.commission_rate || 15}%)</span>
                <span className="font-medium text-orange-600">{ride.commission_amount} F</span>
              </div>
            )}
            {Number(ride.cancellation_fee) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Frais d'annulation</span>
                <span className="font-medium text-red-600">{ride.cancellation_fee} F</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-dashed border-gray-200">
              <span className="font-bold text-gray-800">Total payé</span>
              <span className="font-bold text-primary">{ride.agreed_price} F CFA</span>
            </div>
          </div>

          {/* Passager + Chauffeur */}
          <div className="px-6 py-4 border-b border-gray-100 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Passager</span>
              <span className="font-medium">{ride.passenger_name || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Chauffeur</span>
              <span className="font-medium">{ride.driver_name || '—'}</span>
            </div>
            {ride.driver_vehicle && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Véhicule</span>
                <span className="font-medium">
                  {ride.driver_vehicle.brand} {ride.driver_vehicle.model}
                  {ride.driver_vehicle.plate && ` · ${ride.driver_vehicle.plate}`}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 text-center">
            <p className="text-[10px] text-gray-300">MoveBissau Technologies</p>
          </div>
        </div>

        {/* Actions (hors du ref pour ne pas apparaître dans le PNG) */}
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={downloadReceipt}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50"
          >
            📥 {downloading ? 'Export...' : 'Télécharger PNG'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white border rounded-xl text-gray-600 font-medium text-sm hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

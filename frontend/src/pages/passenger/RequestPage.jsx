import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, Search, Minus, Plus, Send, X, Loader2, Clock } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { useGeolocation } from '../../hooks/useGeolocation';
import L from 'leaflet';

const pickupIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:#1B8A4E;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [16, 16], iconAnchor: [8, 8],
});

const dropoffIcon = L.divIcon({
  className: '',
  html: `<div style="width:24px;height:24px;position:relative"><div style="width:12px;height:12px;background:#CE1126;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);position:absolute;top:0;left:6px"></div><div style="width:2px;height:10px;background:#CE1126;position:absolute;top:12px;left:11px;border-radius:1px"></div></div>`,
  iconSize: [24, 24], iconAnchor: [12, 24],
});

async function searchAddress(query, countryCode = 'gw', centerLat = null, centerLng = null) {
  if (query.length < 3) return [];
  // Construire les params avec viewbox pour biaisage géographique
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: '10',
    countrycodes: countryCode,
    'accept-language': 'fr',
    addressdetails: '1',
  });
  // Viewbox : zone de ~50km autour du centre du pays pour prioriser les résultats locaux
  if (centerLat && centerLng) {
    const delta = 0.5; // ~50km
    params.set('viewbox', `${centerLng - delta},${centerLat + delta},${centerLng + delta},${centerLat - delta}`);
    params.set('bounded', '0'); // Préférer la zone mais autoriser hors zone
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'User-Agent': 'MoveBissau/1.0' } }
  );
  return res.json();
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`,
      { headers: { 'User-Agent': 'MoveBissau/1.0' } }
    );
    const data = await res.json();
    return data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

async function fetchRoute(from, to) {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data.routes?.[0]) return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
  } catch {}
  return null;
}

function MapClickHandler({ onSelect }) {
  useMapEvents({ click(e) { onSelect([e.latlng.lat, e.latlng.lng]); } });
  return null;
}

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 16, { duration: 1 }); }, [position]);
  return null;
}

function getRecentDestinations() {
  try { return JSON.parse(localStorage.getItem('mb_recent_destinations')) || []; } catch { return []; }
}

export default function RequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const country = useCountryConfig();
  const { vehicleType: initialType = 'moto', userPos: stateUserPos, presetDropoff, presetDropoffAddress, preferredDriver } = location.state || {};
  const geo = useGeolocation({ watch: true, defaultLat: country.default_lat, defaultLng: country.default_lng });

  // Demande en cours (bloquante)
  const [activeRequest, setActiveRequest] = useState(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  const [pickup, setPickup] = useState(stateUserPos || geo.position);
  const [pickupFromGeo, setPickupFromGeo] = useState(true);

  // Suivre la position GPS pour le pickup si pas modifié manuellement
  useEffect(() => {
    if (pickupFromGeo && geo.isTracking) {
      setPickup(geo.position);
    }
  }, [geo.position, pickupFromGeo, geo.isTracking]);
  const [pickupAddress, setPickupAddress] = useState('Ma position');
  const [dropoff, setDropoff] = useState(presetDropoff || null);
  const [dropoffAddress, setDropoffAddress] = useState(presetDropoffAddress || '');
  const [vehicleType, setVehicleType] = useState(initialType);
  const [estimate, setEstimate] = useState(null);
  const [price, setPrice] = useState(0);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [routeCoords, setRouteCoords] = useState(null);

  // Vérifier s'il y a une demande en cours au chargement
  useEffect(() => {
    checkActiveRequest();
  }, []);

  const checkActiveRequest = async () => {
    try {
      const requests = await api.get('/rides/requests/active');
      if (requests && requests.id) {
        setActiveRequest(requests);
      }
    } catch { /* pas de demande active */ }
  };

  const cancelActiveRequest = async () => {
    if (!activeRequest) return;
    setCancellingRequest(true);
    try {
      await api.post(`/rides/requests/${activeRequest.id}/cancel`);
      setActiveRequest(null);
      toast.show('Demande annulée', 'success');
    } catch (e) {
      toast.show(e.message || 'Erreur', 'error');
    }
    setCancellingRequest(false);
  };

  // Recherche
  const [searchMode, setSearchMode] = useState(presetDropoffAddress ? null : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const priceInputRef = useRef(null);

  const recents = getRecentDestinations();

  // Recherche avec debounce
  useEffect(() => {
    if (searchQuery.length < 3) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddress(searchQuery, country.country_code, country.default_lat, country.default_lng);
      setSearchResults(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  useEffect(() => { if (searchMode) searchRef.current?.focus(); }, [searchMode]);

  const handleMapClick = useCallback(async (pos) => {
    setDropoff(pos);
    const addr = await reverseGeocode(pos[0], pos[1]);
    setDropoffAddress(addr);
  }, []);

  const selectResult = (result) => {
    const pos = [parseFloat(result.lat), parseFloat(result.lon)];
    const addr = result.display_name.split(',').slice(0, 3).join(',');
    if (searchMode === 'pickup') { setPickup(pos); setPickupAddress(addr); setPickupFromGeo(false); }
    else { setDropoff(pos); setDropoffAddress(addr); }
    setSearchMode(null); setSearchQuery(''); setSearchResults([]);
  };

  // Estimation
  useEffect(() => { if (dropoff) getEstimate(); }, [dropoff, vehicleType]);

  const getEstimate = async () => {
    try {
      const data = await api.post('/rides/estimate', {
        pickup_lat: pickup[0], pickup_lng: pickup[1],
        dropoff_lat: dropoff[0], dropoff_lng: dropoff[1],
        vehicle_type: vehicleType,
      });
      setEstimate(data);
      setPrice(data.suggested_price);
    } catch (e) { setError(e.message); }
  };

  // Route polyline
  useEffect(() => {
    if (!pickup || !dropoff) { setRouteCoords(null); return; }
    fetchRoute(pickup, dropoff).then(coords => { if (coords) setRouteCoords(coords); });
  }, [pickup, dropoff]);

  const getIncrement = () => price >= 1000 ? 100 : 50;

  const adjustPrice = (delta) => {
    const inc = getIncrement();
    const newPrice = price + (delta > 0 ? inc : -inc);
    if (estimate && newPrice >= estimate.min_price && newPrice <= estimate.max_price) {
      setPrice(newPrice);
      navigator.vibrate?.(10);
    }
  };

  const confirmPriceInput = () => {
    const val = parseInt(priceInput);
    if (estimate && val >= estimate.min_price && val <= estimate.max_price) {
      setPrice(val);
    } else if (estimate) {
      toast.show(`Prix entre ${estimate.min_price} et ${estimate.max_price} F`, 'error');
    }
    setEditingPrice(false);
  };

  const sendRequest = async () => {
    if (!dropoff || !price) return;
    setLoading(true); setError('');
    try {
      const requestData = {
        pickup_lat: pickup[0], pickup_lng: pickup[1],
        pickup_address: pickupAddress,
        dropoff_lat: dropoff[0], dropoff_lng: dropoff[1],
        dropoff_address: dropoffAddress,
        proposed_price: price,
        vehicle_type: vehicleType,
      };
      if (preferredDriver?.id) requestData.preferred_driver_id = preferredDriver.id;
      const data = await api.post('/rides/requests', requestData);
      navigator.vibrate?.(20);
      navigate(`/offers/${data.id}`);
    } catch (e) {
      toast.show(e.message || 'Erreur', 'error');
      setLoading(false);
    }
  };

  // === Mode recherche ===
  if (searchMode) {
    return (
      <div className="h-[100dvh] bg-white flex flex-col">
        <div className="px-4 pt-4 pb-2 border-b">
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSearchMode(null); setSearchQuery(''); setSearchResults([]); }}
              className="p-2 rounded-xl hover:bg-gray-100"
            >
              <ArrowLeft size={20} className="text-gray-700" />
            </button>
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchMode === 'pickup' ? 'Rechercher le point de départ...' : 'Rechercher la destination...'}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {searching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-brand-500" />
            </div>
          )}

          {!searching && searchQuery.length >= 3 && searchResults.length === 0 && (
            <div className="text-center py-12">
              <MapPin size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Aucun résultat</p>
              <p className="text-gray-400 text-xs mt-1">Essayez un autre nom ou touchez la carte</p>
            </div>
          )}

          {searchResults.map((result, i) => (
            <motion.button
              key={result.place_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => selectResult(result)}
              className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition text-left border-b border-gray-50"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                searchMode === 'pickup' ? 'bg-brand-50' : 'bg-red-50'
              }`}>
                <MapPin size={16} className={searchMode === 'pickup' ? 'text-brand-500' : 'text-red-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{result.display_name.split(',')[0]}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{result.display_name.split(',').slice(1, 4).join(',')}</p>
                {result.type && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 rounded-full text-[10px] text-gray-500 capitalize">
                    {result.type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </motion.button>
          ))}

          {/* Récents + Suggestions */}
          {searchQuery.length < 3 && (
            <div className="px-5 pt-4">
              {recents.length > 0 && searchMode === 'dropoff' && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Récents</p>
                  {recents.slice(0, 3).map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        if (r.coords) { setDropoff(r.coords); setDropoffAddress(r.address); }
                        setSearchMode(null); setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50 rounded-xl px-2 transition"
                    >
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Clock size={14} className="text-gray-400" />
                      </div>
                      <span className="text-sm text-gray-700 truncate">{r.address}</span>
                    </button>
                  ))}
                  <div className="border-t my-3" />
                </>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Suggestions</p>
              {[
                { name: `Aéroport ${country.country_name.split('-')[0]}`, query: `aéroport ${country.country_name}` },
                { name: 'Marché central', query: `marché ${country.country_name}` },
                { name: 'Gare routière', query: `gare ${country.country_name}` },
                { name: 'Hôpital', query: `hôpital ${country.country_name}` },
              ].map(s => (
                <button
                  key={s.name}
                  onClick={() => setSearchQuery(s.query)}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 rounded-xl px-2 transition"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <MapPin size={14} className="text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-700">{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // === Mode carte ===
  return (
    <div className="h-[100dvh] flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-white z-10 border-b space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 space-y-2">
            <button onClick={() => setSearchMode('pickup')}
              className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-left hover:bg-gray-100 transition">
              <div className="w-2.5 h-2.5 bg-brand-500 rounded-full flex-shrink-0" />
              <span className="text-sm text-gray-700 truncate flex-1">{pickupAddress || 'Point de départ'}</span>
              <Search size={14} className="text-gray-400" />
            </button>
            <button onClick={() => setSearchMode('dropoff')}
              className="w-full flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-left hover:bg-gray-100 transition">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0" />
              <span className={`text-sm truncate flex-1 ${dropoffAddress ? 'text-gray-700' : 'text-gray-400'}`}>
                {dropoffAddress || 'Où allez-vous ?'}
              </span>
              <Search size={14} className="text-gray-400" />
            </button>
          </div>
          <div className="flex flex-col bg-gray-100 rounded-xl p-1 gap-1">
            {['moto', 'car'].map(t => (
              <button key={t} onClick={() => setVehicleType(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  vehicleType === t ? 'bg-white shadow-sm text-brand-600' : 'text-gray-500'
                }`}>
                {t === 'moto' ? '🏍️' : '🚗'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Carte */}
      <div className="flex-1 relative">
        <MapContainer center={pickup} zoom={15} zoomControl={false} className="h-full w-full">
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; OSM' />
          <Marker position={pickup} icon={pickupIcon} />
          {dropoff && <Marker position={dropoff} icon={dropoffIcon} />}
          {dropoff && <FlyTo position={dropoff} />}
          {routeCoords && (
            <Polyline positions={routeCoords} pathOptions={{ color: '#1B8A4E', weight: 4, opacity: 0.7 }} />
          )}
          <MapClickHandler onSelect={handleMapClick} />
        </MapContainer>

        {!dropoff && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl shadow-card z-10">
            <p className="text-sm text-gray-600 flex items-center gap-2">
              <MapPin size={14} className="text-red-500" />
              Recherchez ou touchez la carte
            </p>
          </motion.div>
        )}
      </div>

      {/* Panel de prix */}
      <AnimatePresence>
        {estimate && (
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            transition={{ type: 'spring', damping: 25 }}
            className="bg-white border-t shadow-elevated px-5 pt-5 pb-8"
          >
            {/* Résumé trajet */}
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
              <span className="w-2 h-2 bg-brand-500 rounded-full" />
              <span className="truncate flex-1">{pickupAddress}</span>
              <span>→</span>
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="truncate flex-1">{dropoffAddress}</span>
            </div>

            {/* Distance + prix suggéré */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-gray-400">Distance</p>
                <p className="font-bold text-gray-800">{estimate.distance_km} km</p>
              </div>
              <div className="flex-1 bg-brand-50 rounded-xl px-3 py-2 text-center">
                <p className="text-xs text-brand-600">Prix suggéré</p>
                <p className="font-bold text-brand-700">{estimate.suggested_price} F</p>
              </div>
            </div>

            {/* Chips rapides */}
            <div className="flex gap-2 mb-3 justify-center">
              {[
                { label: 'Min', value: estimate.min_price },
                { label: 'Suggéré', value: estimate.suggested_price },
                { label: 'Max', value: estimate.max_price },
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => { setPrice(chip.value); navigator.vibrate?.(10); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    price === chip.value
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chip.label} · {chip.value} F
                </button>
              ))}
            </div>

            {/* Sélecteur de prix */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-3 text-center">Proposez votre prix</p>
              <div className="flex items-center justify-center gap-4">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => adjustPrice(-1)}
                  disabled={price <= estimate.min_price}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition">
                  <Minus size={20} />
                </motion.button>

                <div className="text-center min-w-[140px]">
                  {editingPrice ? (
                    <input
                      ref={priceInputRef}
                      type="number"
                      autoFocus
                      value={priceInput}
                      onChange={e => setPriceInput(e.target.value)}
                      onBlur={confirmPriceInput}
                      onKeyDown={e => e.key === 'Enter' && confirmPriceInput()}
                      className="w-full text-4xl font-extrabold text-brand-600 text-center outline-none border-b-2 border-brand-500"
                    />
                  ) : (
                    <motion.p
                      key={price}
                      initial={{ scale: 1.15 }}
                      animate={{ scale: 1 }}
                      onClick={() => { setEditingPrice(true); setPriceInput(String(price)); }}
                      className="text-4xl font-extrabold text-brand-600 cursor-text"
                    >
                      {price}
                    </motion.p>
                  )}
                  <p className="text-sm text-gray-400">F CFA</p>
                </div>

                <motion.button whileTap={{ scale: 0.85 }} onClick={() => adjustPrice(1)}
                  disabled={price >= estimate.max_price}
                  className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-30 hover:bg-gray-200 transition">
                  <Plus size={20} />
                </motion.button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-1">
                {estimate.min_price} — {estimate.max_price} F · Touchez le prix pour saisir directement
              </p>
            </div>

            {error && <p className="text-red-500 text-sm text-center mb-2">{error}</p>}

            {activeRequest ? (
              <div className="space-y-2">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-sm text-amber-800 font-medium">Vous avez une demande en cours</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {activeRequest.pickup_address} → {activeRequest.dropoff_address} · {activeRequest.proposed_price} F
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/offers/${activeRequest.id}`)}
                    className="flex-1 bg-brand-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-600 transition"
                  >
                    Voir les offres
                  </button>
                  <button
                    onClick={cancelActiveRequest}
                    disabled={cancellingRequest}
                    className="px-4 py-3 bg-red-50 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-100 transition disabled:opacity-50"
                  >
                    {cancellingRequest ? '...' : 'Annuler'}
                  </button>
                </div>
              </div>
            ) : (
              {preferredDriver && (
                <div className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 mb-2">
                  <span className="text-sm">🎯</span>
                  <p className="text-xs text-brand-700 font-medium">
                    Demande envoyée à <span className="font-bold">{preferredDriver.name}</span>
                  </p>
                </div>
              )}
              <Button onClick={sendRequest} loading={loading} icon={Send}>
                {preferredDriver ? `Demander à ${preferredDriver.name} — ${price} F` : `Envoyer la demande — ${price} F`}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

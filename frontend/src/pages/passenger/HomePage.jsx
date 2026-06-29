import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Menu, MapPin, Navigation, History, User, LogOut,
  Home, Briefcase, Clock, ChevronRight, Edit3, X, Check, Loader2,
  Send, Star
} from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { useGeolocation } from '../../hooks/useGeolocation';
import BottomSheet from '../../components/ui/BottomSheet';
import Onboarding from '../../components/ui/Onboarding';
import L from 'leaflet';

const userIcon = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#1B8A4E;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function makeNearbyIcon(vehicleType) {
  const svg = vehicleType === 'car'
    ? `<svg viewBox="0 0 24 24" width="14" height="14" fill="#1B8A4E"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`
    : `<svg viewBox="0 0 24 24" width="14" height="14" fill="#1B8A4E"><path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM5 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm14 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="width:30px;height:30px;background:white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;transition:transform 0.3s">${svg}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Cache des icônes pour éviter de les recréer
const nearbyIcons = {
  moto: makeNearbyIcon('moto'),
  car: makeNearbyIcon('car'),
};

function LocateUser({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.setView(pos, 15, { animate: true });
  }, [pos]);
  return null;
}

// Salutation contextuelle
function getGreeting() {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return 'Bonjour';
  if (h >= 12 && h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

// LocalStorage helpers pour lieux favoris et récents
function getSavedPlaces() {
  try { return JSON.parse(localStorage.getItem('mb_saved_places')) || {}; } catch { return {}; }
}
function setSavedPlaces(places) {
  localStorage.setItem('mb_saved_places', JSON.stringify(places));
}
function getRecentDestinations() {
  try { return JSON.parse(localStorage.getItem('mb_recent_destinations')) || []; } catch { return []; }
}
export function addRecentDestination(dest) {
  const recents = getRecentDestinations();
  // Dédupliquer par adresse
  const filtered = recents.filter(r => r.address !== dest.address);
  const updated = [dest, ...filtered].slice(0, 5);
  localStorage.setItem('mb_recent_destinations', JSON.stringify(updated));
}

export default function HomePage() {
  const country = useCountryConfig();
  const geo = useGeolocation({ watch: true, defaultLat: country.default_lat, defaultLng: country.default_lng });
  const userPos = geo.position;
  const [menuOpen, setMenuOpen] = useState(false);
  const [vehicleType, setVehicleType] = useState('moto');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('mb_onboarded'));
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Favoris
  const [savedPlaces, setSavedPlacesState] = useState(getSavedPlaces());
  const [editingPlace, setEditingPlace] = useState(null); // 'home' | 'work' | null
  const [editValue, setEditValue] = useState('');

  // Récents
  const recents = getRecentDestinations();

  // Demande ou course en cours
  const [activeRequest, setActiveRequest] = useState(null);
  const [activeRide, setActiveRide] = useState(null);

  // Chauffeurs proches
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);

  useEffect(() => {
    checkActiveTrips();
  }, []);

  // Polling chauffeurs proches toutes les 10s
  useEffect(() => {
    fetchNearbyDrivers();
    const interval = setInterval(fetchNearbyDrivers, 10000);
    return () => clearInterval(interval);
  }, [userPos, vehicleType]);

  const fetchNearbyDrivers = async () => {
    try {
      const data = await api.get(
        `/drivers/nearby?lat=${userPos[0]}&lng=${userPos[1]}&type=${vehicleType}`
      );
      if (Array.isArray(data)) setNearbyDrivers(data);
    } catch {}
  };

  const checkActiveTrips = async () => {
    // Vérifier demande en cours
    try {
      const req = await api.get('/rides/requests/active');
      if (req && req.id) { setActiveRequest(req); return; }
    } catch {}
    // Vérifier course en cours
    try {
      const rides = await api.get('/rides/history?status=active');
      if (rides?.results?.length > 0) { setActiveRide(rides.results[0]); }
    } catch {}
  };

  const savePlace = (key) => {
    if (!editValue.trim()) return;
    const updated = { ...savedPlaces, [key]: { label: editValue.trim() } };
    setSavedPlaces(updated);
    setSavedPlacesState(updated);
    setEditingPlace(null);
    setEditValue('');
  };

  const goToRequest = (dropoffData) => {
    navigate('/request', {
      state: {
        vehicleType,
        userPos,
        ...(dropoffData || {}),
      },
    });
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-gray-100">
      {/* Carte */}
      <MapContainer
        center={userPos}
        zoom={15}
        zoomControl={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OSM &copy; CARTO'
        />
        <Marker position={userPos} icon={userIcon} />
        {nearbyDrivers.map(d => (
          <Marker
            key={d.id}
            position={[d.lat, d.lng]}
            icon={nearbyIcons[d.vehicle_type] || nearbyIcons.moto}
            eventHandlers={{ click: () => setSelectedDriver(d) }}
          />
        ))}
        <LocateUser pos={userPos} />
      </MapContainer>

      {/* Header flottant */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setMenuOpen(true)}
          className="w-11 h-11 bg-white rounded-2xl shadow-card flex items-center justify-center"
        >
          <Menu size={20} className="text-gray-700" />
        </motion.button>
        <div className="flex-1" />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={geo.locate}
          className={`w-11 h-11 rounded-2xl shadow-card flex items-center justify-center transition-colors ${
            geo.isTracking ? 'bg-white' : 'bg-red-50'
          }`}
        >
          {geo.loading ? (
            <Loader2 size={18} className="text-brand-500 animate-spin" />
          ) : (
            <Navigation size={18} className={geo.isTracking ? 'text-brand-500' : 'text-red-400'} />
          )}
        </motion.button>
      </div>

      {/* Carte profil chauffeur sélectionné */}
      <AnimatePresence>
        {selectedDriver && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25 }}
            className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-6"
          >
            <div className="bg-white rounded-3xl shadow-elevated overflow-hidden border border-gray-100">
              {/* Header avec close */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h3 className="font-bold text-gray-800">Chauffeur disponible</h3>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <div className="px-5 pb-4">
                {/* Profil */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedDriver.avatar_url ? (
                      <img src={selectedDriver.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{selectedDriver.vehicle_type === 'moto' ? '🏍️' : '🚗'}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-800 text-lg">{selectedDriver.first_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-sm text-amber-500">
                        <Star size={14} className="fill-amber-400" />
                        {selectedDriver.rating > 0 ? selectedDriver.rating.toFixed(1) : 'Nouveau'}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{selectedDriver.total_rides} courses</span>
                    </div>
                  </div>
                </div>

                {/* Stats rapides */}
                <div className="flex gap-2 mb-4">
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-400">Distance</p>
                    <p className="font-bold text-gray-800 text-sm">
                      {selectedDriver.distance_m < 1000
                        ? `${selectedDriver.distance_m} m`
                        : `${(selectedDriver.distance_m / 1000).toFixed(1)} km`
                      }
                    </p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                    <p className="text-xs text-gray-400">Véhicule</p>
                    <p className="font-bold text-gray-800 text-sm">
                      {selectedDriver.vehicle_type === 'moto' ? 'Moto' : 'Voiture'}
                    </p>
                  </div>
                  {selectedDriver.vehicle && (
                    <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2.5 text-center">
                      <p className="text-xs text-gray-400">Modèle</p>
                      <p className="font-bold text-gray-800 text-sm truncate">
                        {selectedDriver.vehicle.brand || selectedDriver.vehicle.model || '—'}
                      </p>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setSelectedDriver(null);
                    navigate('/request', {
                      state: {
                        vehicleType: selectedDriver.vehicle_type,
                        userPos,
                        preferredDriver: {
                          id: selectedDriver.id,
                          name: selectedDriver.first_name,
                        },
                      },
                    });
                  }}
                  className="w-full bg-gradient-to-r from-brand-500 to-emerald-500 text-white font-bold py-4 rounded-2xl shadow-md
                             flex items-center justify-center gap-2 hover:shadow-lg transition-shadow"
                >
                  <Send size={18} />
                  Demander ce chauffeur
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom sheet */}
      <BottomSheet>
        {/* Salutation contextuelle */}
        <div className="mb-4">
          <p className="text-gray-500 text-sm">{getGreeting()}</p>
          <h2 className="text-xl font-bold text-gray-800">
            {user?.first_name || 'Passager'} 👋
          </h2>
        </div>

        {/* Erreur GPS */}
        {geo.error && (
          <motion.button
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={geo.locate}
            className="w-full bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-3 mb-3 text-left"
          >
            <Navigation size={18} className="text-red-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">{geo.error}</p>
              <p className="text-xs text-red-500">Touchez pour réessayer</p>
            </div>
          </motion.button>
        )}

        {/* Demande en cours */}
        {activeRequest && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/offers/${activeRequest.id}`)}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl px-4 py-4 flex items-center gap-3 mb-4 shadow-md"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Loader2 size={20} className="text-white animate-spin" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">Demande en cours</p>
              <p className="text-white/80 text-xs truncate">
                {activeRequest.dropoff_address || 'En attente de chauffeurs'} · {activeRequest.proposed_price} F
              </p>
            </div>
            <ChevronRight size={20} className="text-white/70" />
          </motion.button>
        )}

        {/* Course en cours */}
        {activeRide && !activeRequest && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/tracking/${activeRide.id}`)}
            className="w-full bg-gradient-to-r from-brand-500 to-emerald-500 text-white rounded-2xl px-4 py-4 flex items-center gap-3 mb-4 shadow-md"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
              {activeRide.vehicle_type === 'moto' ? '🏍️' : '🚗'}
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">Course en cours</p>
              <p className="text-white/80 text-xs truncate">
                {activeRide.dropoff_address} · {activeRide.agreed_price} F
              </p>
            </div>
            <ChevronRight size={20} className="text-white/70" />
          </motion.button>
        )}

        {/* Barre de recherche */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => goToRequest()}
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 flex items-center gap-3 mb-4
                     hover:bg-gray-100 hover:border-gray-300 transition-all text-left"
        >
          <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
            <Search size={18} className="text-brand-500" />
          </div>
          <div>
            <p className="font-medium text-gray-800">Où allez-vous ?</p>
            <p className="text-xs text-gray-400">Touchez pour choisir votre destination</p>
          </div>
        </motion.button>

        {/* Raccourcis Maison / Travail */}
        <div className="flex gap-2 mb-4">
          {[
            { key: 'home', icon: Home, label: 'Maison', color: 'text-blue-500', bg: 'bg-blue-50' },
            { key: 'work', icon: Briefcase, label: 'Travail', color: 'text-purple-500', bg: 'bg-purple-50' },
          ].map(place => {
            const saved = savedPlaces[place.key];
            const isEditing = editingPlace === place.key;

            return (
              <div key={place.key} className="flex-1">
                {isEditing ? (
                  <div className="flex items-center gap-1 bg-white border-2 border-brand-500 rounded-xl px-2 py-2">
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      placeholder={`Adresse ${place.label.toLowerCase()}`}
                      className="flex-1 text-xs outline-none min-w-0"
                      onKeyDown={e => e.key === 'Enter' && savePlace(place.key)}
                    />
                    <button onClick={() => savePlace(place.key)} className="p-1 text-brand-500">
                      <Check size={14} />
                    </button>
                    <button onClick={() => setEditingPlace(null)} className="p-1 text-gray-400">
                      <X size={14} />
                    </button>
                  </div>
                ) : saved ? (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => goToRequest({ presetDropoffAddress: saved.label })}
                    className="w-full flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-left hover:bg-gray-50 transition group"
                  >
                    <place.icon size={16} className={place.color} />
                    <span className="text-sm text-gray-700 truncate flex-1">{saved.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingPlace(place.key); setEditValue(saved.label); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5"
                    >
                      <Edit3 size={12} className="text-gray-400" />
                    </button>
                  </motion.button>
                ) : (
                  <button
                    onClick={() => { setEditingPlace(place.key); setEditValue(''); }}
                    className="w-full flex items-center gap-2 bg-gray-50 border border-dashed border-gray-300 rounded-xl px-3 py-2.5 text-left hover:bg-gray-100 transition"
                  >
                    <place.icon size={16} className="text-gray-400" />
                    <span className="text-xs text-gray-400">+ {place.label}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Destinations récentes */}
        {recents.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Récents</p>
            <div className="space-y-1">
              {recents.slice(0, 3).map((r, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => goToRequest({
                    presetDropoff: r.coords,
                    presetDropoffAddress: r.address,
                  })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Clock size={14} className="text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-700 truncate flex-1">{r.address}</p>
                  <ChevronRight size={14} className="text-gray-300" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Sélection véhicule */}
        <div className="flex gap-3">
          {[
            { type: 'moto', icon: '🏍️', label: 'Moto-taxi', desc: 'Rapide & économique' },
            { type: 'car', icon: '🚗', label: 'Voiture', desc: 'Confort & espace' },
          ].map(v => (
            <motion.button
              key={v.type}
              whileTap={{ scale: 0.96 }}
              onClick={() => setVehicleType(v.type)}
              className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
                vehicleType === v.type
                  ? 'border-brand-500 bg-brand-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{v.icon}</span>
              <p className={`font-semibold text-sm mt-1 ${vehicleType === v.type ? 'text-brand-700' : 'text-gray-700'}`}>
                {v.label}
              </p>
              <p className="text-xs text-gray-400">{v.desc}</p>
            </motion.button>
          ))}
        </div>

        {/* Indicateur chauffeurs proches */}
        {nearbyDrivers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mt-3 py-2"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-brand-600">{nearbyDrivers.length}</span> chauffeur{nearbyDrivers.length > 1 ? 's' : ''} à proximité
            </p>
          </motion.div>
        )}
      </BottomSheet>

      {/* Menu latéral */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute inset-y-0 left-0 w-72 bg-white z-50 shadow-elevated"
            >
              <div className="bg-brand-500 px-5 pt-12 pb-6">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center overflow-hidden">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl text-white font-bold">{user?.first_name?.[0] || '?'}</span>
                  )}
                </div>
                <h3 className="text-white font-bold text-lg mt-3">
                  {user?.first_name} {user?.last_name}
                </h3>
                <p className="text-brand-200 text-sm">{user?.phone}</p>
              </div>

              <nav className="p-3 space-y-1">
                {[
                  { icon: History, label: 'Historique', to: '/history' },
                  { icon: User, label: 'Mon profil', to: '/profile' },
                ].map(item => (
                  <button
                    key={item.to}
                    onClick={() => { setMenuOpen(false); navigate(item.to); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-gray-100 transition"
                  >
                    <item.icon size={20} className="text-gray-500" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}

                <div className="border-t my-3" />

                <button
                  onClick={() => { logout(); navigate('/welcome'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition"
                >
                  <LogOut size={20} />
                  <span className="font-medium">Déconnexion</span>
                </button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Onboarding première connexion (overlay) */}
      {showOnboarding && (
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

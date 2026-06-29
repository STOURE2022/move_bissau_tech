import { useEffect, useRef, useState } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * Marqueur chauffeur animé — interpolation fluide entre les positions.
 * L'icône tourne dans la direction du mouvement (heading).
 */

// Calcul du heading entre deux points
function calcHeading(from, to) {
  if (!from || !to) return 0;
  const dLng = (to[1] - from[1]) * Math.PI / 180;
  const lat1 = from[0] * Math.PI / 180;
  const lat2 = to[0] * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function createDriverIcon(vehicleType, heading = 0) {
  const isCar = vehicleType === 'car';

  // Icône voiture 3D vue de dessus
  const carSvg = `<svg viewBox="0 0 50 50" width="38" height="38">
    <defs>
      <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#2d2d2d"/>
        <stop offset="100%" style="stop-color:#1a1a1a"/>
      </linearGradient>
      <linearGradient id="wg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#87CEEB;stop-opacity:0.9"/>
        <stop offset="100%" style="stop-color:#4A90D9;stop-opacity:0.7"/>
      </linearGradient>
    </defs>
    <!-- Ombre -->
    <ellipse cx="25" cy="47" rx="14" ry="3" fill="rgba(0,0,0,0.15)"/>
    <!-- Corps voiture -->
    <rect x="11" y="8" width="28" height="34" rx="8" fill="url(#cg)"/>
    <!-- Toit/pare-brise avant -->
    <rect x="14" y="12" width="22" height="10" rx="4" fill="url(#wg)"/>
    <!-- Lunette arrière -->
    <rect x="15" y="30" width="20" height="7" rx="3" fill="url(#wg)" opacity="0.6"/>
    <!-- Roues -->
    <rect x="8" y="13" width="5" height="8" rx="2.5" fill="#111"/>
    <rect x="37" y="13" width="5" height="8" rx="2.5" fill="#111"/>
    <rect x="8" y="30" width="5" height="8" rx="2.5" fill="#111"/>
    <rect x="37" y="30" width="5" height="8" rx="2.5" fill="#111"/>
    <!-- Phares avant -->
    <rect x="14" y="8" width="6" height="3" rx="1.5" fill="#FFD700" opacity="0.9"/>
    <rect x="30" y="8" width="6" height="3" rx="1.5" fill="#FFD700" opacity="0.9"/>
    <!-- Feux arrière -->
    <rect x="14" y="39" width="5" height="2" rx="1" fill="#FF3333" opacity="0.8"/>
    <rect x="31" y="39" width="5" height="2" rx="1" fill="#FF3333" opacity="0.8"/>
    <!-- Reflet -->
    <rect x="16" y="14" width="8" height="4" rx="2" fill="white" opacity="0.3"/>
  </svg>`;

  // Icône moto 3D vue de dessus
  const motoSvg = `<svg viewBox="0 0 50 50" width="38" height="38">
    <defs>
      <linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#E53E3E"/>
        <stop offset="100%" style="stop-color:#C53030"/>
      </linearGradient>
    </defs>
    <!-- Ombre -->
    <ellipse cx="25" cy="47" rx="10" ry="3" fill="rgba(0,0,0,0.15)"/>
    <!-- Roue arrière -->
    <ellipse cx="25" cy="38" rx="7" ry="7" fill="#222" stroke="#444" stroke-width="1.5"/>
    <ellipse cx="25" cy="38" rx="3" ry="3" fill="#666"/>
    <!-- Corps moto -->
    <rect x="21" y="14" width="8" height="22" rx="4" fill="url(#mg)"/>
    <!-- Réservoir -->
    <ellipse cx="25" cy="22" rx="6" ry="4" fill="url(#mg)"/>
    <ellipse cx="25" cy="22" rx="4" ry="2.5" fill="#FF6B6B" opacity="0.5"/>
    <!-- Roue avant -->
    <ellipse cx="25" cy="10" rx="6" ry="6" fill="#222" stroke="#444" stroke-width="1.5"/>
    <ellipse cx="25" cy="10" rx="2.5" ry="2.5" fill="#666"/>
    <!-- Guidon -->
    <rect x="14" y="8" width="22" height="3" rx="1.5" fill="#333"/>
    <!-- Phare -->
    <ellipse cx="25" cy="6" rx="3" ry="2" fill="#FFD700" opacity="0.9"/>
    <!-- Selle -->
    <ellipse cx="25" cy="30" rx="5" ry="3" fill="#1a1a1a"/>
    <!-- Casque conducteur -->
    <ellipse cx="25" cy="26" rx="4.5" ry="4" fill="#222"/>
    <ellipse cx="25" cy="25" rx="3.5" ry="2.5" fill="#333"/>
    <rect x="22" y="23" width="6" height="2" rx="1" fill="#87CEEB" opacity="0.5"/>
    <!-- Feu arrière -->
    <rect x="22" y="42" width="6" height="2" rx="1" fill="#FF3333" opacity="0.8"/>
  </svg>`;

  const svg = isCar ? carSvg : motoSvg;

  return L.divIcon({
    className: '',
    html: `<div style="
      width:50px;height:50px;
      filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));
      transform:rotate(${heading}deg);
      transition:transform 1s ease;
      display:flex;align-items:center;justify-content:center;
    ">${svg}</div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
  });
}

// Interpolation linéaire entre deux valeurs
function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function AnimatedDriverMarker({ position, vehicleType, followCamera = false }) {
  const markerRef = useRef(null);
  const prevPosRef = useRef(null);
  const animFrameRef = useRef(null);
  const [heading, setHeading] = useState(0);
  const [smoothPos, setSmoothPos] = useState(position);
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    const prev = prevPosRef.current;

    if (prev) {
      // Calculer le heading
      const newHeading = calcHeading(prev, position);
      if (Math.abs(newHeading - heading) > 5) {
        setHeading(newHeading);
      }

      // Animer le déplacement sur 2 secondes (60 frames)
      const startPos = [...prev];
      const endPos = [...position];
      const duration = 2000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease out cubic pour un mouvement naturel
        const eased = 1 - Math.pow(1 - t, 3);

        const lat = lerp(startPos[0], endPos[0], eased);
        const lng = lerp(startPos[1], endPos[1], eased);
        setSmoothPos([lat, lng]);

        // Suivre avec la caméra
        if (followCamera && t < 1) {
          map.panTo([lat, lng], { animate: false });
        }

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        }
      };

      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      setSmoothPos(position);
      if (followCamera) {
        map.panTo(position, { animate: true, duration: 1 });
      }
    }

    prevPosRef.current = [...position];

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [position?.[0], position?.[1]]);

  if (!smoothPos) return null;

  const icon = createDriverIcon(vehicleType, heading);

  return (
    <Marker
      ref={markerRef}
      position={smoothPos}
      icon={icon}
    />
  );
}

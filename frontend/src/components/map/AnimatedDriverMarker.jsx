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
  const svg = isCar
    ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>`
    : `<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="M19.44 9.03L15.41 5H11v2h3.59l2 2H5c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.46 0 4.45-1.69 4.9-4h1.65l2.77-2.77c-.21.54-.32 1.14-.32 1.77 0 2.8 2.2 5 5 5s5-2.2 5-5c0-2.65-1.97-4.77-4.56-4.97zM5 15c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm14 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`;

  return L.divIcon({
    className: '',
    html: `<div style="
      width:46px;height:46px;
      background:#1B8A4E;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 3px 14px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      transform:rotate(${heading - 90}deg);
      transition:transform 1s ease;
    ">${svg}</div>`,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
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

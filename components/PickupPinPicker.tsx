'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { mapCenter, type PickupPin } from '@/lib/pickup-location';

export default function PickupPinPicker({ locality, suggested, value, onChange }: {
  locality: string; suggested?: PickupPin; value?: PickupPin; onChange: (pin: PickupPin) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const latest = useRef(onChange);
  useEffect(() => { latest.current = onChange; }, [onChange]);
  const lat = suggested?.lat ?? mapCenter(locality).lat;
  const lng = suggested?.lng ?? mapCenter(locality).lng;
  const mapRef = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  useEffect(() => {
    if (!node.current) return;
    const map = L.map(node.current).setView([lat, lng], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    }).addTo(map);
    map.on('click', ({ latlng }) => latest.current({ lat: latlng.lat, lng: latlng.lng }));
    const size = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    size.observe(node.current);
    mapRef.current = map;
    return () => { size.disconnect(); map.remove(); mapRef.current = null; marker.current = null; };
  }, [lat, lng]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (marker.current) map.removeLayer(marker.current);
    marker.current = value ? L.circleMarker([value.lat, value.lng], { radius: 9, color: '#fff', fillColor: '#0066ff', fillOpacity: 1, interactive: false }).addTo(map) : null;
  }, [value, lat, lng]);
  return <div className="space-y-2">
    <div ref={node} className="isolate h-56 w-full rounded-xl" aria-label="Map for choosing the pickup location" />
    <button type="button" className="rounded-lg bg-blue-900 px-3 py-2 text-blue-100" onClick={() => {
      const center = mapRef.current?.getCenter();
      if (center) onChange({ lat: center.lat, lng: center.lng });
    }}>Use map centre</button>
  </div>;
}

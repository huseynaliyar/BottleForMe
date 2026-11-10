'use client';

import { useLanguage } from '@/lib/language-context';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MALTA_LOCALITIES, PickupOffer } from '@/lib/types';

export default function RadarMap({ offers, onSelectOffer }: {
  offers: PickupOffer[];
  onSelectOffer?: (offer: PickupOffer) => void;
}) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const selectRef = useRef(onSelectOffer);

  useEffect(() => { selectRef.current = onSelectOffer; }, [onSelectOffer]);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { center: [35.908, 14.495], zoom: 11, zoomControl: false, zoomAnimation: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'dark-map-tiles',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(container.current);

    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  const canSelect = Boolean(onSelectOffer);
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const locality of MALTA_LOCALITIES) {
      const matching = offers.filter((offer) => offer.locality === locality.name);
      if (!matching.length) continue;

      const position = L.latLng(locality.lat, locality.lng);
      bounds.extend(position);
      const label = document.createElement('span');
      label.className = 'grid size-8 place-items-center rounded-full border-2 border-blue-400 bg-slate-950 font-bold text-white';
      label.textContent = String(matching.length);
      const icon = L.divIcon({ className: 'custom-radar-pin', html: label, iconSize: [32, 32], iconAnchor: [16, 16] });
      const marker = L.marker(position, { icon, title: locality.name, alt: locality.name }).addTo(layer);
      marker.getElement()?.setAttribute('aria-label', locality.name);
      const popup = document.createElement('div');
      popup.className = 'max-h-44 min-w-40 overflow-y-auto text-slate-100';
      const heading = document.createElement('strong');
      heading.textContent = locality.name;
      popup.append(heading);

      for (const offer of matching) {
        const entry = document.createElement('div');
        entry.className = 'mt-2 border-t border-slate-600 pt-2';
        const details = document.createElement('span');
        details.textContent = `${offer.estimated_bottles} items · €${offer.seller_payout.toFixed(2)} to seller`;
        entry.append(details);
        if (canSelect) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'mt-1 block rounded-lg bg-blue-600 px-2 py-1 text-white';
          button.textContent = 'View pickup';
          button.onclick = () => {
            selectRef.current?.(offer);
            marker.closePopup();
          };
          entry.append(button);
        }
        popup.append(entry);
      }
      marker.bindPopup(popup, { className: 'dark-leaflet-popup' });
    }

    if (bounds.isValid()) map.fitBounds(bounds, { maxZoom: 13, padding: [24, 24], animate: false });
  }, [offers, canSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={container} className="h-full w-full" role="region" aria-label="Radar map by locality" />
      <p className="pointer-events-none absolute bottom-5 left-2 z-[500] rounded-full bg-[#080b12]/90 px-2.5 py-1 text-[10px] text-blue-200">{t("Pins show locality centers.")}</p>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { PickupOffer } from '@/lib/types';

interface RadarMapProps {
  offers: PickupOffer[];
  selectedOffer: PickupOffer | null;
  onSelectOffer: (offer: PickupOffer) => void;
}

export default function RadarMap({ offers, selectedOffer, onSelectOffer }: RadarMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize Leaflet Map centered on Malta Northern Harbour (Sliema/Gzira/Valletta)
      const map = L.map(mapContainerRef.current, {
        center: [35.908, 14.495],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      });

      // Standard OpenStreetMap tiles (100% Free, NO API Key needed, no watermarks)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        className: 'dark-map-tiles',
      }).addTo(map);

      // Add zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    offers.forEach((offer) => {
      const lat = offer.lat || 35.9122;
      const lng = offer.lng || 14.5042;
      const isSelected = selectedOffer?.id === offer.id;

      // Custom HTML Marker matching Midnight Navy & Electric Blue design
      const isFree = offer.split_percentage === 0;
      const markerColor = isFree ? '#00e599' : '#0066ff';
      const markerBg = isFree ? 'rgba(0, 229, 153, 0.25)' : 'rgba(0, 102, 255, 0.3)';
      const markerBorder = isSelected ? '#ffffff' : markerColor;

      const customIcon = L.divIcon({
        className: 'custom-radar-pin',
        html: `
          <div style="
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #080d1a;
            border: 2px solid ${markerBorder};
            box-shadow: 0 0 16px ${markerColor}88, inset 0 0 8px ${markerBg};
            cursor: pointer;
            transition: transform 0.2s;
          ">
            <span style="
              font-size: 11px;
              font-weight: 800;
              color: white;
              font-family: inherit;
            ">${offer.bag_count}b</span>
            ${isSelected ? '<span style="position: absolute; top: -3px; right: -3px; width: 10px; height: 10px; background: #00e599; border-radius: 50%; border: 2px solid #080b12;"></span>' : ''}
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer);

      const popupContent = document.createElement('div');
      popupContent.style.cssText = 'padding: 4px; min-width: 170px; font-family: inherit;';
      popupContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13px; font-weight: 800; color: #ffffff;">${offer.locality}</span>
          <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; background: ${isFree ? 'rgba(0,229,153,0.2)' : 'rgba(59,130,246,0.2)'}; color: ${isFree ? '#00e599' : '#60a5fa'};">
            ${isFree ? '100% Free' : `${offer.split_percentage}% Split`}
          </span>
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin: 0 0 8px 0;">
          ${offer.bag_count} Bags (~${offer.estimated_bottles} plastic, cans, glass)
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 11px;">
          <span style="color: #cbd5e1;">Taker Reward:</span>
          <strong style="color: #00e599; font-size: 13px;">€${offer.collector_profit.toFixed(2)}</strong>
        </div>
        <button id="reserve-btn-${offer.id}" style="
          width: 100%;
          padding: 7px 12px;
          border-radius: 10px;
          background: #0066ff;
          color: white;
          font-weight: 700;
          font-size: 11px;
          border: none;
          cursor: pointer;
        ">
          Select & Claim Route
        </button>
      `;

      marker.bindPopup(popupContent, {
        className: 'dark-leaflet-popup',
        closeButton: false,
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`reserve-btn-${offer.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectOffer(offer);
            map.closePopup();
          };
        }
      });
    });

    return () => {
      // cleanup on unmount
    };
  }, [offers, selectedOffer, onSelectOffer]);

  return (
    <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-blue-500/25 shadow-inner">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-full bg-[#080b12]/90 border border-white/10 text-[10px] text-blue-200/80 font-medium z-10 pointer-events-none">
        📍 Tap pins to view bottles & claim route
      </div>
    </div>
  );
}

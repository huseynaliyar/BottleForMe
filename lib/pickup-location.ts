import { MALTA_LOCALITIES, type PickupOffer } from './types';

export type PickupPin = { lat: number; lng: number };
export const isPickupPin = (value: unknown): value is PickupPin => {
  if (!value || typeof value !== 'object') return false;
  const { lat, lng } = value as Partial<PickupPin>;
  return typeof lat === 'number' && typeof lng === 'number' && lat >= 35.78 && lat <= 36.16 && lng >= 14.15 && lng <= 14.62;
};

export const mapCenter = (locality: string): PickupPin =>
  MALTA_LOCALITIES.find((item) => item.name === locality) ?? { lat: 35.908, lng: 14.495 };

export function radarPins(offers: PickupOffer[]) {
  const groups = new Map<string, { pin: PickupPin; name: string; offers: PickupOffer[] }>();
  for (const offer of offers) {
    const pin = isPickupPin(offer) ? { lat: offer.lat, lng: offer.lng } : mapCenter(offer.locality);
    const key = pin.lat + ':' + pin.lng;
    const group = groups.get(key) ?? { pin, name: offer.locality, offers: [] };
    group.offers.push(offer);
    groups.set(key, group);
  }
  return [...groups.entries()];
}

export function pickupMapUrl(offer: PickupOffer) {
  const street = offer.address_notes?.split('\n')[0]?.trim();
  const exact = offer.exact_pin && isPickupPin(offer);
  if (!exact && !street) return null;
  const target = exact ? offer.lat + ',' + offer.lng : street + ', ' + offer.locality + ', Malta';
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(target);
}

export const pickupSteps = ['Confirmed', 'On the way', 'Arrived', 'Complete'] as const;
export function pickupStep(status: PickupOffer['status']) {
  return status === 'completed' ? 3 : status === 'arrived' ? 2 : status === 'en_route' ? 1 : 0;
}

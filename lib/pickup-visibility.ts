import { isPickupPin } from './pickup-location';
import { MALTA_LOCALITIES, PickupOffer } from './types';

export const PUBLIC_COLUMNS = 'id,locality,bag_count,bag_policy,containers,estimated_bottles,total_bcrs_value,split_percentage,seller_payout,collector_profit,payout_method,status,created_at,updated_at,availability';

type PinRow = { pickup_lat?: number | null; pickup_lng?: number | null; share_exact_pin?: boolean };
export const PIN_COLUMNS = 'pickup_lat,pickup_lng,share_exact_pin';
export const RADAR_COLUMNS = `${PUBLIC_COLUMNS},${PIN_COLUMNS}` as const;

export function publicPickup(row: Partial<PickupOffer> & PinRow) {
  const locality = MALTA_LOCALITIES.find((item) => item.name === row.locality);
  const fields = Object.fromEntries(PUBLIC_COLUMNS.split(',').map((key) => [key, row[key as keyof PickupOffer]]));
  const pin = { lat: row.pickup_lat, lng: row.pickup_lng };
  const exact = row.share_exact_pin && isPickupPin(pin);
  return { ...fields, seller_name: 'Giver', address_notes: '', exact_pin: !!exact, lat: exact ? pin.lat : locality?.lat, lng: exact ? pin.lng : locality?.lng };
}

export function participantPickup<T extends Partial<PickupOffer> & PinRow & { status: string }>(input: T, userId: string) {
  const { pickup_lat, pickup_lng, share_exact_pin, ...row } = input;
  const pin = { lat: pickup_lat, lng: pickup_lng };
  const exact: Pick<PickupOffer, 'lat' | 'lng' | 'exact_pin'> = isPickupPin(pin) ? { ...pin, exact_pin: true } : { exact_pin: false };
  const active = ['reserved', 'en_route', 'arrived'].includes(row.status);
  const overdue = active && !!row.confirmed_at && Date.parse(row.confirmed_at) <= Date.now() - 3_600_000;
  if (row.seller_id === userId) return { ...row, ...exact, overdue };
  if (row.collector_id !== userId) return publicPickup({ ...row, pickup_lat, pickup_lng, share_exact_pin });
  if (row.seller_id && active) return { ...row, ...exact, seller_phone: null, collector_phone: null, overdue };
  return { ...row, address_notes: '', seller_phone: null, seller_revolut_tag: null, exact_pin: false, lat: undefined, lng: undefined };
}

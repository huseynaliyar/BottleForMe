import { MALTA_LOCALITIES, PickupOffer } from './types';

export const PUBLIC_COLUMNS = 'id,locality,bag_count,bag_policy,containers,estimated_bottles,total_bcrs_value,split_percentage,seller_payout,collector_profit,payout_method,status,created_at,updated_at,availability';

export function publicPickup(row: Partial<PickupOffer>) {
  const locality = MALTA_LOCALITIES.find((item) => item.name === row.locality);
  const fields = Object.fromEntries(PUBLIC_COLUMNS.split(',').map((key) => [key, row[key as keyof PickupOffer]]));
  return { ...fields, seller_name: 'Giver', address_notes: '', lat: locality?.lat, lng: locality?.lng };
}

export function participantPickup<T extends Partial<PickupOffer> & { status: string }>(row: T, userId: string) {
  const active = ['reserved', 'en_route', 'arrived'].includes(row.status);
  const overdue = active && !!row.confirmed_at && Date.parse(row.confirmed_at) <= Date.now() - 3_600_000;
  if (row.seller_id === userId) return { ...row, overdue };
  if (row.collector_id !== userId) return publicPickup(row);
  if (row.seller_id && active) return { ...row, overdue };
  const locality = MALTA_LOCALITIES.find((item) => item.name === row.locality);
  return { ...row, address_notes: '', seller_phone: null, seller_revolut_tag: null, lat: locality?.lat, lng: locality?.lng };
}

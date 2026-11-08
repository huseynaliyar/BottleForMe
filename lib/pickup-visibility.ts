import { MALTA_LOCALITIES, PickupOffer } from './types';

export const PUBLIC_COLUMNS = 'id,locality,bag_count,containers,estimated_bottles,total_bcrs_value,split_percentage,seller_payout,collector_profit,payout_method,status,created_at,updated_at';

export function publicPickup(row: Partial<PickupOffer>) {
  const locality = MALTA_LOCALITIES.find((item) => item.name === row.locality);
  const fields = Object.fromEntries(PUBLIC_COLUMNS.split(',').map((key) => [key, row[key as keyof PickupOffer]]));
  return { ...fields, seller_name: 'Giver', address_notes: '', lat: locality?.lat, lng: locality?.lng };
}

export function participantPickup<T extends Partial<PickupOffer> & { status: string }>(row: T, userId: string) {
  if (row.seller_id === userId) return row;
  if (row.collector_id !== userId) return publicPickup(row);
  if (row.seller_id && ['reserved', 'en_route', 'arrived'].includes(row.status)) return row;
  return { ...row, address_notes: '', seller_phone: null, seller_revolut_tag: null };
}

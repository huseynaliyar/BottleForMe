import type { PickupOffer } from './types';

const euros = new Intl.NumberFormat('en-MT', { style: 'currency', currency: 'EUR' });
export const formatEuro = (cents: number) => euros.format(cents / 100);

export function pickupBalance(offers: PickupOffer[], userId: string) {
  const entries = offers
    .filter((offer) => offer.status === 'completed' && (offer.seller_id === userId || offer.collector_id === userId))
    .map((offer) => ({
      id: offer.id,
      locality: offer.locality,
      date: offer.updated_at,
      role: offer.seller_id === userId ? 'Giver' : 'Taker',
      earnings: Math.round((offer.seller_id === userId ? offer.seller_payout : offer.collector_profit) * 100),
      deposit: Math.round(offer.total_bcrs_value * 100),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    entries,
    earnings: entries.reduce((sum, entry) => sum + entry.earnings, 0),
    deposit: entries.reduce((sum, entry) => sum + entry.deposit, 0),
  };
}

export const balanceNote = 'Estimates from completed pickups. BottleForMe does not process or verify payments.';

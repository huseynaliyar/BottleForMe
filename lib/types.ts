export type PickupStatus =
  | 'open'        // Listed on Malta radar, waiting for collector
  | 'reserved'    // Collector claimed offer, coordinating handover
  | 'en_route'    // Collector driving to doorstep
  | 'arrived'     // Collector at door
  | 'completed'   // Handover complete & payment confirmed
  | 'cancelled';

export type PayoutMethod = 'revolut' | 'cash' | 'charity';

export interface PickupOffer {
  id: string;
  seller_name: string;
  seller_phone?: string;
  seller_revolut_tag?: string;
  locality: string;
  address_notes: string;
  bag_count: number;
  estimated_bottles: number;
  total_bcrs_value: number; // In Euros (€0.10 per container in Malta)
  split_percentage: number; // 0% (free gift) to 70% (50% is default)
  seller_payout: number;    // Amount seller receives at doorstep
  collector_profit: number; // Margin collector keeps from RVM redemption
  payout_method: PayoutMethod;
  status: PickupStatus;
  collector_name?: string;
  collector_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface MaltaLocality {
  id: string;
  name: string;
  region: 'Northern Harbour' | 'Southern Harbour' | 'Northern' | 'Western' | 'South Eastern' | 'Gozo';
  active_offers: number;
}

export const MALTA_LOCALITIES: MaltaLocality[] = [
  { id: 'sliema', name: 'Sliema', region: 'Northern Harbour', active_offers: 4 },
  { id: 'birkirkara', name: 'Birkirkara', region: 'Northern Harbour', active_offers: 3 },
  { id: 'gzira', name: 'Gzira', region: 'Northern Harbour', active_offers: 2 },
  { id: 'stjulians', name: "St Julian's", region: 'Northern Harbour', active_offers: 3 },
  { id: 'mosta', name: 'Mosta', region: 'Northern', active_offers: 2 },
  { id: 'msida', name: 'Msida', region: 'Northern Harbour', active_offers: 2 },
  { id: 'stpaulsbay', name: "St Paul's Bay", region: 'Northern', active_offers: 1 },
  { id: 'qormi', name: 'Qormi', region: 'Northern Harbour', active_offers: 1 },
  { id: 'gozo', name: 'Gozo (Victoria)', region: 'Gozo', active_offers: 1 },
];

/**
 * Calculates BCRS economics based on bags and split percentage
 */
export function calculateBcrsSplit(bags: number, splitPercentage: number) {
  const avgBottlesPerBag = 35;
  const estimatedBottles = bags * avgBottlesPerBag;
  const bcrsRate = 0.10; // €0.10 per bottle/can in Malta
  const totalBcrsValue = Number((estimatedBottles * bcrsRate).toFixed(2));
  const sellerPayout = Number((totalBcrsValue * (splitPercentage / 100)).toFixed(2));
  const collectorProfit = Number((totalBcrsValue - sellerPayout).toFixed(2));

  return {
    estimatedBottles,
    totalBcrsValue,
    sellerPayout,
    collectorProfit,
  };
}

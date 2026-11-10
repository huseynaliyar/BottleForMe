import type { PickupWindow } from './pickup-schedule';

export type PickupStatus =
  | 'open'        // Listed on Malta radar, waiting for collector
  | 'reserved'    // Collector claimed offer, coordinating handover
  | 'en_route'    // Collector driving to doorstep
  | 'arrived'     // Collector at door
  | 'completed'   // Handover recorded by collector
  | 'cancelled';

export type PayoutMethod = 'revolut' | 'cash' | 'charity';

export type UserRole = 'giver' | 'taker' | 'both';

export interface ContainerBreakdown {
  plastic_bottles: number;
  cans: number;
  glass_bottles: number;
}

export interface PickupOffer {
  overdue?: boolean;
  archived_at?: string | null;
  bag_policy?: import('./bag-policy').BagPolicy | null;
  id: string;
  seller_id?: string | null;
  collector_id?: string | null;
  availability?: PickupWindow[] | null;
  confirmed_at?: string | null;
  availability_version?: number;
  seller_name: string;
  seller_phone?: string;
  seller_revolut_tag?: string;
  locality: string;
  address_notes: string;
  bag_count: number;
  containers?: ContainerBreakdown | null;
  estimated_bottles: number;
  total_bcrs_value: number; // Estimated voucher value in € (€0.10 per eligible container)
  split_percentage: number; // 0% (free gift to taker) to 70% (50% is default)
  seller_payout: number;    // Amount giver receives at doorstep
  collector_profit: number; // Reward taker keeps from recycling redemption
  payout_method: PayoutMethod;
  status: PickupStatus;
  collector_name?: string;
  collector_phone?: string;
  created_at: string;
  updated_at: string;
  lat?: number;
  lng?: number;
}

export interface MaltaLocality {
  id: string;
  name: string;
  region: 'Northern Harbour' | 'Southern Harbour' | 'Northern' | 'Western' | 'South Eastern' | 'Gozo';
  active_offers: number;
  lat: number;
  lng: number;
}

export const MALTA_LOCALITIES: MaltaLocality[] = [
  { id: 'sliema', name: 'Sliema', region: 'Northern Harbour', active_offers: 4, lat: 35.9122, lng: 14.5042 },
  { id: 'gzira', name: 'Gzira', region: 'Northern Harbour', active_offers: 2, lat: 35.9058, lng: 14.4953 },
  { id: 'stjulians', name: "St Julian's", region: 'Northern Harbour', active_offers: 3, lat: 35.9186, lng: 14.4900 },
  { id: 'birkirkara', name: 'Birkirkara', region: 'Northern Harbour', active_offers: 3, lat: 35.8972, lng: 14.4611 },
  { id: 'valletta', name: 'Valletta', region: 'Southern Harbour', active_offers: 2, lat: 35.8989, lng: 14.5146 },
  { id: 'msida', name: 'Msida', region: 'Northern Harbour', active_offers: 2, lat: 35.8958, lng: 14.4861 },
  { id: 'mosta', name: 'Mosta', region: 'Northern', active_offers: 2, lat: 35.9094, lng: 14.4256 },
  { id: 'stpaulsbay', name: "St Paul's Bay", region: 'Northern', active_offers: 1, lat: 35.9506, lng: 14.4056 },
  { id: 'qormi', name: 'Qormi', region: 'Northern Harbour', active_offers: 1, lat: 35.8778, lng: 14.4719 },
  { id: 'gozo', name: 'Gozo (Victoria)', region: 'Gozo', active_offers: 1, lat: 36.0444, lng: 14.2417 },
];

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  revolut_tag: string;
  role: UserRole;
  avatar_url?: string;
  locality: string;
  rating: number;
  total_bottles_recycled: number;
  total_earnings: number;
  created_at?: string;
}

export interface NotificationItem {
  pickupId?: string;
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'pickup' | 'arrival' | 'payment' | 'system';
}

// Keep all calculations in cents until the final display/database conversion.
export function calculateDepositSplit(
  plasticCount: number,
  canCount: number,
  glassCount: number,
  splitPercentage: number
) {
  const totalContainers = plasticCount + canCount + glassCount;
  const depositCents = totalContainers * 10;
  const payoutCents = Math.round(depositCents * splitPercentage / 100);

  return {
    totalContainers,
    totalDepositValue: depositCents / 100,
    sellerPayout: payoutCents / 100,
    collectorProfit: (depositCents - payoutCents) / 100,
  };
}

import { calculateDepositSplit, MALTA_LOCALITIES } from './types';

export const MAX_CONTAINERS = 10_000;
export const MAX_BAGS = 20;
export const MAX_SELLER_SPLIT = 70;
export const REVOLUT_TAG = /^@?[a-z0-9_]{1,50}$/i;

export function validatePickup(input: unknown) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  if (typeof body.containers !== 'object' || body.containers === null || Array.isArray(body.containers)) return null;
  const counts = body.containers as Record<string, unknown>;
  const { plastic_bottles, cans, glass_bottles } = counts;
  if (typeof plastic_bottles !== 'number' || typeof cans !== 'number' || typeof glass_bottles !== 'number' ||
      ![plastic_bottles, cans, glass_bottles].every((count) => Number.isSafeInteger(count) && count >= 0)) return null;

  const { bag_count, split_percentage, payout_method, locality, address_notes, seller_revolut_tag } = body;
  if (typeof bag_count !== 'number' || !Number.isInteger(bag_count) || bag_count < 1 || bag_count > MAX_BAGS ||
      typeof split_percentage !== 'number' || !Number.isInteger(split_percentage) ||
      split_percentage < 0 || split_percentage > MAX_SELLER_SPLIT ||
      (payout_method !== 'cash' && payout_method !== 'revolut') ||
      typeof locality !== 'string' || !MALTA_LOCALITIES.some((item) => item.name === locality) ||
      typeof address_notes !== 'string' || !address_notes.trim() || address_notes.trim().length > 300) return null;

  const totals = calculateDepositSplit(plastic_bottles, cans, glass_bottles, split_percentage);
  if (totals.totalContainers < 1 || totals.totalContainers > MAX_CONTAINERS) return null;
  const needsTag = payout_method === 'revolut' && totals.sellerPayout > 0;
  if (needsTag && (typeof seller_revolut_tag !== 'string' || !REVOLUT_TAG.test(seller_revolut_tag.trim()))) return null;

  return {
    locality,
    bag_count,
    split_percentage,
    payout_method,
    address_notes: address_notes.trim(),
    seller_revolut_tag: needsTag ? '@' + (seller_revolut_tag as string).trim().replace(/^@/, '') : null,
    containers: { plastic_bottles, cans, glass_bottles },
    estimated_bottles: totals.totalContainers,
    total_bcrs_value: totals.totalDepositValue,
    seller_payout: totals.sellerPayout,
    collector_profit: totals.collectorProfit,
  };
}

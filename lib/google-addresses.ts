import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AddressSuggestion } from './pickup-address';

const key = process.env.GOOGLE_PLACES_API_KEY;
export const addressLookupEnabled = !!key;

function proofFor(userId: string, address: string) {
  return createHmac('sha256', key!).update(JSON.stringify(['pickup-address-v1', userId, address])).digest();
}

export function hasConfirmedAddress(userId: string, address: unknown, proof: unknown, storedAddress: string) {
  if (!key) return true;
  if (typeof address !== 'string' || !address || address.length > 240 ||
    typeof proof !== 'string' || !/^[a-f0-9]{64}$/.test(proof)) return false;
  if (storedAddress !== address && !storedAddress.startsWith(address + '\n')) return false;
  return timingSafeEqual(proofFor(userId, address), Buffer.from(proof, 'hex'));
}

export async function findGoogleAddresses(input: string, userId: string): Promise<AddressSuggestion[]> {
  if (!key) return [];
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'suggestions.placePrediction.text.text',
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['mt'],
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
      languageCode: 'en',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Address lookup failed.');
  const payload: { suggestions?: { placePrediction?: { text?: { text?: string } } }[] } = await response.json();
  const addresses = (payload.suggestions ?? []).map((item) => item.placePrediction?.text?.text?.trim())
    .filter((address): address is string => !!address && address.length <= 240 && !/[\r\n]/.test(address));
  return [...new Set(addresses)].slice(0, 5).map((address) => ({ address, proof: proofFor(userId, address).toString('hex') }));
}

'use client';

import { useEffect, useState } from 'react';
import { searchPickupAddresses } from '@/lib/auth';
import type { AddressSuggestion } from '@/lib/pickup-address';

export default function PickupAddressField({ value, selection, enabled, signedIn, onChange, onSelect }: {
  value: string; selection: AddressSuggestion | null; enabled: boolean; signedIn: boolean;
  onChange: (value: string) => void; onSelect: (value: AddressSuggestion) => void;
}) {
  const [lookup, setLookup] = useState<{ query: string; suggestions: AddressSuggestion[]; message?: string }>();
  const query = value.trim();
  const shouldSearch = enabled && signedIn && !selection && query.length >= 3;

  useEffect(() => {
    if (!shouldSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPickupAddresses(query, controller.signal).then(({ suggestions }) => {
        if (!controller.signal.aborted) setLookup({ query, suggestions });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setLookup({ query, suggestions: [], message: error instanceof Error ? error.message : 'Address lookup failed.' });
      });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, shouldSearch]);

  const result = shouldSearch && lookup?.query === query ? lookup : null;
  return <div className="space-y-1.5">
    <label htmlFor="pickup-address" className="text-xs font-semibold text-blue-200">Pickup address</label>
    <input id="pickup-address" value={value} autoComplete="off" maxLength={240}
      onChange={(event) => { setLookup(undefined); onChange(event.target.value); }} placeholder="Start with the street and number"
      className="w-full rounded-2xl border border-blue-500/25 bg-[#0b1220] px-3 py-2.5 text-white placeholder-blue-300/40" />
    {enabled && <p className="text-xs text-blue-200">Street address searches are sent to Google Maps. Enter door or intercom details in the separate instructions field.</p>}
    {selection && <p className="text-xs text-emerald-300" role="status">Address selected</p>}
    {enabled && !signedIn && <p className="text-xs text-blue-200">Sign in to confirm your address with Google Maps.</p>}
    {result && (result.suggestions.length ? (
      <div className="overflow-hidden rounded-xl border border-blue-500/30 bg-[#0b1220]">
        <ul>
          {result.suggestions.map((item) => <li key={item.proof}>
            <button type="button" onClick={() => onSelect(item)}
              className="w-full border-b border-blue-500/15 p-3 text-left text-sm text-white hover:bg-blue-950 focus-visible:bg-blue-950">
              {item.address}
            </button>
          </li>)}
        </ul>
        <p className="px-3 py-2 text-xs text-white" translate="no">Google Maps</p>
      </div>
    ) : <p className="text-xs text-blue-200" role="status">{result.message ?? 'No matching street address. Try adding the town or house number.'}</p>)}
  </div>;
}

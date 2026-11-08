export type AddressSuggestion = { address: string; proof: string };

export function pickupAddressText(address: string, instructions: string) {
  return [address.trim(), instructions.trim()].filter(Boolean).join('\n');
}

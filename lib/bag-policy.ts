export const bagPolicies = [
  { value: 'included', label: 'Bags are included' },
  { value: 'retained', label: 'Giver keeps the bags' },
] as const;

export type BagPolicy = (typeof bagPolicies)[number]['value'];

export function isBagPolicy(value: unknown): value is BagPolicy {
  return bagPolicies.some((option) => option.value === value);
}

export function bagPolicyLabel(value: unknown) {
  if (value === 'return_required') return 'Taker must return the bags';
  return bagPolicies.find((option) => option.value === value)?.label ?? 'Bag arrangements not specified';
}

export type PickupRestriction = { message: string; pickupId?: string };

export function pickupRestriction(error: unknown): PickupRestriction | undefined {
  if (!(error instanceof Error) || !('code' in error) ||
    (error.code !== 'pickup_overdue' && error.code !== 'pickup_limit')) return;
  const pickupId = 'pickupId' in error && typeof error.pickupId === 'string' ? error.pickupId : undefined;
  return { message: error.message, pickupId };
}

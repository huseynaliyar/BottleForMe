export const adminPickupStatuses = ['open', 'reserved', 'en_route', 'arrived', 'completed', 'cancelled'] as const;

export type AdminPickupStatus = (typeof adminPickupStatuses)[number];

export function isAdminUser(userId: string, allowlist?: string) {
  return !!userId && (allowlist ?? '').split(',').some((entry) => entry.trim().toLowerCase() === userId.toLowerCase());
}

export type AdminPickup = {
  id: string;
  locality: string;
  status: AdminPickupStatus | null;
  estimated_bottles: number;
  bag_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminProfile = {
  id: string;
  full_name: string;
  role: 'giver' | 'taker' | 'both' | null;
  locality: string | null;
  created_at: string | null;
};

export type AdminPage = {
  total: number;
  pageSize: number;
} & ({ view: 'pickups'; rows: AdminPickup[] } | { view: 'profiles'; rows: AdminProfile[] });

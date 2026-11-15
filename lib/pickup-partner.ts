export type Review = { stars: number; comment: string };

export type PickupPartner = {
  name: string;
  role: 'Giver' | 'Taker';
  phone: string | null;
  average: number | null;
  count: number;
  canReview: boolean;
  blockedByYou: boolean;
  reviewGiven: Review | null;
  reviewReceived: Review | null;
};

export const maskedPickupPhone = '*****';

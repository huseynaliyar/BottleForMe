export type Review = { stars: number; comment: string };

export type PickupPartner = {
  name: string;
  role: 'Giver' | 'Taker';
  phone: string | null;
  average: number | null;
  count: number;
  canReview: boolean;
  reviewGiven: Review | null;
  reviewReceived: Review | null;
};

export const pickupPhoneHelp = 'Allow the other participant to see your phone number while a confirmed pickup is active. It stays hidden on Radar and after the pickup ends.';

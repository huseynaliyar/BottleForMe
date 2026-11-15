import type { PickupOffer } from './types';

export function pickupConversationTitle(offer: PickupOffer, taker: boolean, t: (text: string) => string) {
  if (!offer.collector_id || !offer.seller_id) return offer.locality;
  return taker ? offer.seller_name?.trim() || t('Giver') : offer.collector_name?.trim() || t('Taker');
}

export function pickupInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toUpperCase();
}

export function pickupMoney(locale: string, amount: number) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-MT' : locale, { style: 'currency', currency: 'EUR' }).format(amount);
}

export function pickupCardDate(locale: string, offer: PickupOffer) {
  const date = new Date(offer.confirmed_at || offer.updated_at || offer.created_at);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Malta' }).format(date);
}

export function pickupDetails(offer: PickupOffer, taker: boolean, locale: string, t: (text: string) => string) {
  const date = offer.confirmed_at ? new Date(offer.confirmed_at) : null;
  const time = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(locale, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Malta',
  }).format(date) : null;
  const statuses = { open: 'Open', reserved: 'Confirmed', en_route: 'On the way', arrived: 'Arrived', completed: 'Completed', cancelled: 'Cancelled' };
  const paymentMethod = offer.payout_method === 'cash' ? t('Cash') : offer.payout_method === 'revolut' ? 'Revolut' : t('As agreed');
  return {
    time,
    status: t(offer.overdue ? 'Overdue' : offer.archived_at ? 'Archived' : statuses[offer.status]),
    rows: [
      { label: t('Pickup address'), value: offer.address_notes?.trim() || t('Address unavailable') },
      { label: t('Collecting'), value: `${offer.estimated_bottles} ${t('Containers').toLocaleLowerCase(locale)} · ${offer.bag_count} ${t(offer.bag_count === 1 ? 'Bag' : 'Bags').toLocaleLowerCase(locale)}` },
      { label: t(taker ? 'Pay the giver' : 'You receive'), value: offer.seller_payout === 0 ? t('Free pickup') : pickupMoney(locale, offer.seller_payout) + ' · ' + paymentMethod },
    ],
  };
}

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

export function pickupChatPattern(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs>
    <pattern id="pickup-doodles" width="124" height="108" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="${color}" stroke-opacity=".13" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 10h6v7l4 5v18a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V22l4-5zm-4 17h14M9 34h14" transform="rotate(-17 16 26)"/>
        <path d="M58 17h20a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-9l-7 5v-5h-4a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5zm3 7h14m-14 5h9"/>
        <circle cx="103" cy="56" r="9"/><path d="M105 52c-5-3-7 6-1 8m-6-5h7"/>
        <path d="M33 66h13l-1 19H34zm2-4h9l2 4m-13 5h13m-12 10h11" transform="rotate(13 40 74)"/>
        <path d="m74 75 4 5 8-9M14 93h5m-2-2v5m81-75h5m-2-2v5"/>
      </g>
    </pattern></defs><rect width="100%" height="100%" fill="url(#pickup-doodles)"/></svg>`;
}

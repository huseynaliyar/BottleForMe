import { useEffect, useState } from 'react';
import { getPickupAvatar } from './backend';
import { Image, Pressable, View } from 'react-native';
import { ChevronLeft, ChevronRight, Package, Wine } from 'lucide-react-native';
import { useLanguage } from '../../lib/language-context';
import { isRtl } from '../../lib/locale';
import { pickupCardDate, pickupConversationTitle, pickupInitials, pickupMoney } from '../../lib/pickup-conversation';
import type { PickupOffer } from '../../lib/types';
import { StatusPill, Text, useUi } from './ui';

export function PickupAvatar({ name, listing = false, pickupId }: { name: string; listing?: boolean; pickupId?: string }) {
  const { colors } = useUi();
  const [photo, setPhoto] = useState<{ id: string; avatar: string | null }>();
  useEffect(() => {
    if (!pickupId) return;
    const controller = new AbortController();
    getPickupAvatar(pickupId, controller.signal).then(({ avatar }) => {
      if (!controller.signal.aborted) setPhoto({ id: pickupId, avatar });
    }).catch(() => {});
    return () => controller.abort();
  }, [pickupId]);
  const avatar = photo?.id === pickupId ? photo?.avatar : undefined;
  return <View accessible={false} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.chip,
    borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
    {avatar ? <Image source={{ uri: avatar }} style={{ width: 42, height: 42, borderRadius: 21 }} /> : listing ? <Package size={18} color={colors.sky} /> : <Text weight="heavy" style={{ color: colors.lightBlue }}>{pickupInitials(name)}</Text>}
  </View>;
}

export default function PickupConversationCard({ offer, taker, status, unread = 0, onOpen }: {
  offer: PickupOffer; taker: boolean; status: string; unread?: number; onOpen: () => void;
}) {
  const { locale, t } = useLanguage();
  const { colors, styles } = useUi();
  const assigned = !!(offer.collector_id && offer.seller_id);
  const title = pickupConversationTitle(offer, taker, t);
  const Chevron = isRtl(locale) ? ChevronLeft : ChevronRight;
  return <Pressable accessibilityRole="button" accessibilityHint={t(assigned ? 'Open chat' : 'Pickup details')} onPress={onOpen}
    style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <PickupAvatar name={title} listing={!assigned} pickupId={assigned ? offer.id : undefined} />
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text weight="heavy" style={styles.body} numberOfLines={1}>{title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
          <Text accessibilityLabel={offer.estimated_bottles + ' ' + t('Containers')} style={styles.small}>{offer.estimated_bottles} ×</Text>
          <Wine size={14} color={colors.sky} />
          <Text weight="bold" style={[styles.small, { color: colors.green }]}>
            {t(assigned ? (taker ? 'You earn' : 'You receive') : 'Deposit value')}{' '}
            {pickupMoney(locale, assigned ? (taker ? offer.collector_profit : offer.seller_payout) : offer.total_bcrs_value)}
          </Text>
        </View>
        <StatusPill status={offer.overdue ? 'overdue' : offer.status}>{status}</StatusPill>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={styles.muted}>{pickupCardDate(locale, offer)}</Text>
        {unread > 0 ? <Text accessibilityLabel={unread + ' ' + t('Unread messages')} weight="bold"
          style={{ color: colors.onAccent, backgroundColor: colors.blue, borderRadius: 12, overflow: 'hidden', minWidth: 22, textAlign: 'center', padding: 2 }}>
          {unread}
        </Text> : <Chevron size={16} color={colors.sky} />}
      </View>
    </View>
  </Pressable>;
}

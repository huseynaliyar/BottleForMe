import { useLanguage } from '../../lib/language-context';
import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { AppState, BackHandler, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';
import { messageTime, usePickupChat, usePickupUnread as useUnread } from '../../lib/use-pickup-chat';
import { getChat, getListingPhoto, getUnreadChats, postChat } from './backend';
import { Button, Card, ErrorText, Loading, Text, useUi } from './ui';
import { ChevronLeft, ChevronRight, MapPin, Package, Send, Wallet, Wine } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PickupAvatar } from './PickupConversationCard';
import { isRtl } from '../../lib/locale';
import { pickupChatPattern, pickupConversationTitle, pickupDetails, pickupMoney } from '../../lib/pickup-conversation';
import type { PickupOffer } from '../../lib/types';

const visible = () => AppState.currentState === 'active' || AppState.currentState === null;
function subscribe(listener: () => void) {
  const sub = AppState.addEventListener('change', (state) => { if (state === 'active') listener(); });
  return () => sub.remove();
}

export function usePickupUnread(userId?: string) {
  return useUnread(userId, getUnreadChats, visible, subscribe);
}

export function PickupChatFallback({ message, onBack, action }: {
  message: string; onBack: () => void; action?: { label: string; run: () => void };
}) {
  const { locale, t } = useLanguage();
  const { colors, styles } = useUi();
  const Chevron = isRtl(locale) ? ChevronRight : ChevronLeft;
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => back.remove();
  }, [onBack]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: colors.panel }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('← All pickups')} onPress={onBack}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Chevron size={24} color={colors.sky} />
      </Pressable>
      <Text accessibilityRole="header" weight="heavy" style={styles.title}>{t('Pickup chat')}</Text>
    </View>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16 }}>
      <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>{message}</Text>
      {action && <Button label={action.label} onPress={action.run} />}
    </View>
  </View>;
}

const detailIcons = [MapPin, Package, Wallet];

export default function PickupChat({ offer, taker, onRead, onBack, onDetails }: {
  offer: PickupOffer; taker: boolean; onRead: () => void; onBack: () => void; onDetails: () => void;
}) {
  const { locale, t } = useLanguage();
  const { colors, styles, theme } = useUi();
  const title = pickupConversationTitle(offer, taker, t);
  const Chevron = isRtl(locale) ? ChevronRight : ChevronLeft;
  const chat = usePickupChat(offer.id, onRead, getChat, postChat, visible, subscribe, randomUUID);
  const [photo, setPhoto] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const details = pickupDetails(offer, taker, locale, t);
  const { bottom } = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const split = Math.max(0, Math.min(100, offer.split_percentage));
  useEffect(() => {
    let active = true;
    void getListingPhoto(offer.id).then(({ photo }) => { if (active) setPhoto(photo); }).catch(() => {});
    return () => { active = false; };
  }, [offer.id]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onBack(); return true; });
    return () => back.remove();
  }, [onBack]);
  useEffect(() => {
    if (!chat.latest) return;
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [chat.latest]);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <SvgXml xml={pickupChatPattern(colors.sky)} width="100%" height="100%" />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: colors.panel,
      borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('← All pickups')} onPress={onBack}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <Chevron size={24} color={colors.sky} />
      </Pressable>
      <PickupAvatar name={title} pickupId={offer.id} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text accessibilityRole="header" weight="heavy" style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.muted} numberOfLines={1}>{offer.locality} · {t('Pickup chat')}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails(true)}
        style={{ minHeight: 44, paddingHorizontal: 8, borderRadius: 12, backgroundColor: colors.chip, justifyContent: 'center' }}>
        <Text weight="bold" style={[styles.small, { color: colors.lightBlue }]}>{t('Pickup details')}</Text>
      </Pressable>
    </View>
    <Card style={{ margin: 12, padding: 10, borderRadius: 18, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 70, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.chip,
        alignItems: 'center', justifyContent: 'center' }}>
        {photo ? <Image source={{ uri: photo }} accessibilityLabel={t('Bottles or bags for this pickup')} style={{ width: '100%', height: '100%' }} />
          : <Package size={23} color={colors.sky} />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={styles.between}>
          <View style={styles.row}><Text weight="heavy" style={styles.body}
            accessibilityLabel={offer.estimated_bottles + ' ' + t('Containers')}>{offer.estimated_bottles} ×</Text><Wine size={15} color={colors.sky} /></View>
          <Text weight="heavy" style={styles.body}>{pickupMoney(locale, offer.total_bcrs_value)}</Text>
        </View>
        <View style={{ height: 5, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.green }}>
          <View style={{ height: 5, width: `${split}%`, backgroundColor: colors.blue }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.muted}>{t(taker ? 'You pay' : 'You receive')} · {split}%</Text>
            <Text weight="heavy" style={[styles.small, { color: colors.sky }]}>{pickupMoney(locale, offer.seller_payout)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.muted}>{t(taker ? 'You earn' : 'Taker earns')} · {100 - split}%</Text>
            <Text weight="heavy" style={[styles.small, { color: colors.green }]}>{pickupMoney(locale, offer.collector_profit)}</Text>
          </View>
        </View>
      </View>
    </Card>
    <View style={{ paddingHorizontal: 12 }}><ErrorText message={chat.error} /></View>
    {!chat.current && !chat.error && <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Loading label={t('Loading chat…')} />
    </View>}
    {chat.current && <>
      {chat.hasEarlier && chat.current.messages.length === 50 && <Button label={chat.loadingEarlier ? t('Loading…') : t('Load earlier messages')}
        kind="quiet" disabled={chat.loadingEarlier} onPress={() => void chat.loadEarlier()} />}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 8, padding: 12, flexGrow: 1,
        justifyContent: chat.messages.length ? 'flex-start' : 'center' }} keyboardShouldPersistTaps="handled">
        {!chat.messages.length && <Text style={[styles.small, { alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 14,
          overflow: 'hidden', paddingVertical: 6, paddingHorizontal: 12 }]}>{t('No messages yet.')}</Text>}
        {chat.messages.map((item) => <View key={item.seq} style={[styles.inset, { maxWidth: '85%',
          alignSelf: item.mine ? 'flex-end' : 'flex-start', backgroundColor: item.mine ? colors.chip : colors.panel }]}>
          <Text weight="bold" style={styles.muted}>{item.mine ? t('You') : title} · {messageTime.format(new Date(item.created_at))}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>)}
      </ScrollView>
      {chat.current.canSend ? <View style={{ padding: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, borderWidth: 1, borderColor: colors.border,
          backgroundColor: colors.panel, borderRadius: 26, padding: 4 }}>
          <TextInput accessibilityLabel={t('Message')} placeholder={t('Type your message…')} placeholderTextColor={colors.placeholder}
            keyboardAppearance={theme} multiline value={chat.draft} onChangeText={chat.setDraft} editable={!chat.sending} maxLength={1000}
            style={{ flex: 1, color: colors.ink, minHeight: 44, maxHeight: 104, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={chat.sending ? t('Sending…') : t('Send message')}
            disabled={chat.sending || !chat.draft.trim()} onPress={() => void chat.send()}
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.blue, opacity: chat.sending || !chat.draft.trim() ? 0.5 : 1 }}>
            <Send size={18} color={colors.onAccent} style={{ transform: [{ scaleX: isRtl(locale) ? -1 : 1 }] }} />
          </Pressable>
        </View>
        <ErrorText message={chat.sendError} />
      </View> : <Text style={[styles.small, { padding: 12, textAlign: 'center', backgroundColor: colors.panel }]}>{t('This conversation is read-only.')}</Text>}
    </>}
    <Modal transparent visible={showDetails} animationType="slide" onRequestClose={() => setShowDetails(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.50)' }}>
        <View accessibilityViewIsModal style={{ maxHeight: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          overflow: 'hidden', backgroundColor: colors.panel }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: Math.max(16, bottom), gap: 4, direction: isRtl(locale) ? 'rtl' : 'ltr' }}>
            <View style={styles.between}>
              <Text weight="bold" style={{ color: offer.overdue || offer.status === 'cancelled' ? colors.red : colors.green }}>{details.status}</Text>
              <Button kind="secondary" label={t('Back to chat')} onPress={() => setShowDetails(false)} />
            </View>
            <Text accessibilityRole="header" weight="heavy" style={styles.title}>{details.time ?? t('Time to be agreed')}</Text>
            {details.time && <Text style={styles.muted}>{t('Malta time')}</Text>}
            <View style={{ marginTop: 10 }}>
              {details.rows.map(({ label, value }, index) => {
                const Icon = detailIcons[index];
                return <View key={label} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10, gap: 4 }}>
                  <View style={styles.row}><Icon size={16} color={colors.sky} /><Text style={styles.small}>{label}</Text></View>
                  <Text style={[styles.body, { marginStart: 24 }]}>{value}</Text>
                </View>;
              })}
            </View>
            <Button kind="secondary" label={t('Manage pickup')} onPress={() => { setShowDetails(false); onDetails(); }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

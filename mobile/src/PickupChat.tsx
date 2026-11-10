import { useEffect, useRef } from 'react';
import { randomUUID } from 'expo-crypto';
import { AppState, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { messageTime, usePickupChat, usePickupUnread as useUnread } from '../../lib/use-pickup-chat';
import { getChat, getUnreadChats, postChat } from './backend';
import { Button, Card, ErrorText, Field, Loading, styles, Text } from './ui';

const visible = () => AppState.currentState === 'active' || AppState.currentState === null;
function subscribe(listener: () => void) {
  const sub = AppState.addEventListener('change', (state) => { if (state === 'active') listener(); });
  return () => sub.remove();
}

export function usePickupUnread(userId?: string) {
  return useUnread(userId, getUnreadChats, visible, subscribe);
}

export default function PickupChat({ pickupId, onRead, onBack }: { pickupId: string; onRead: () => void; onBack: () => void }) {
  const chat = usePickupChat(pickupId, onRead, getChat, postChat, visible, subscribe, randomUUID);
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (!chat.latest) return;
    const frame = requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: false }));
    return () => cancelAnimationFrame(frame);
  }, [chat.latest]);
  return <View style={[styles.scroll, { flex: 1 }]}>
    <Button label="‹ Pickup details" kind="quiet" onPress={onBack} />
    <Text accessibilityRole="header" weight="bold" style={styles.title}>Pickup chat</Text>
    <ErrorText message={chat.error} />
    {!chat.current && !chat.error && <Loading label="Loading chat…" />}
    {chat.current && <>
      {chat.hasEarlier && chat.current.messages.length === 50 && <Button label={chat.loadingEarlier ? 'Loading…' : 'Load earlier messages'}
        kind="quiet" disabled={chat.loadingEarlier} onPress={() => void chat.loadEarlier()} />}
      <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {!chat.messages.length && <Text style={styles.small}>No messages yet.</Text>}
        {chat.messages.map((item) => <View key={item.seq} style={[styles.inset, item.mine ? { marginLeft: 24 } : { marginRight: 24 }]}>
          <Text weight="bold" style={styles.muted}>{item.mine ? 'You' : 'Pickup partner'} · {messageTime.format(new Date(item.created_at))}</Text>
          <Text style={styles.body}>{item.body}</Text>
        </View>)}
      </ScrollView>
      {chat.current.canSend ? <Card>
        <Field label="Message" multiline value={chat.draft} onChangeText={chat.setDraft} editable={!chat.sending} maxLength={1000} />
        <Button label={chat.sending ? 'Sending…' : 'Send message'} disabled={chat.sending || !chat.draft.trim()} onPress={() => void chat.send()} />
        <ErrorText message={chat.sendError} />
      </Card> : <Text style={styles.small}>This pickup has ended. You can read the messages here.</Text>}
    </>}
  </View>;
}

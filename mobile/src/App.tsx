import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Bell, Check, Compass, MessageSquare, Package, User } from 'lucide-react-native';
import { AppState, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useMarketplaceStatus } from '../../lib/use-marketplace-status';
import { useInbox } from '../../lib/use-inbox';
import { useMobilePush } from './useMobilePush';
import type { NotificationItem, PickupOffer, PickupStatus, UserProfile } from '../../lib/types';
import { AccountDialog, Avatar, ProfileScreen } from './AccountScreen';
import { apiOrigin, changePickup, errorMessage, loadProfile, saveProfile, signOut, supabase } from './backend';
import { HandoverScreen, RadarScreen, usePickupFeed } from './Pickups';
import { PostScreen } from './PostScreen';
import { Badge, Button, Card, colors, Dialog, ErrorText, Loading, Segmented, styles, Text } from './ui';

const primaryTabs = [
  { value: 'give', label: 'List Empties' },
  { value: 'radar', label: 'Radar' },
  { value: 'handover', label: 'Handover' },
] as const;
const tabs = [
  { value: 'give', label: 'Give', Icon: Package },
  { value: 'radar', label: 'Radar', Icon: Compass },
  { value: 'handover', label: 'Handover', Icon: MessageSquare },
  { value: 'profile', label: 'Profile', Icon: User },
] as const;
type Tab = (typeof tabs)[number]['value'];

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  return <SafeAreaProvider>
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      {fontsLoaded || fontError ? <Marketplace /> : <View style={appStyles.frame} />}
    </SafeAreaView>
  </SafeAreaProvider>;
}

function Marketplace() {
  const maintenance = useMarketplaceStatus(apiOrigin);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [requestedTab, setTab] = useState<Tab>('give');
  const [dialog, setDialog] = useState<'account' | 'activity'>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [revision, setRevision] = useState(0);
  const [radarReset, setRadarReset] = useState(0);
  const [draftReset, setDraftReset] = useState(0);
  const [selectedId, setSelectedId] = useState<string>();
  const [recentPickup, setRecentPickup] = useState<{ userId: string; offer: PickupOffer }>();
  const [sessionNotifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toast, setToast] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const accountId = useRef<string | undefined>(undefined);
  const updating = useRef(false);
  const savingProfile = useRef(false);
  const sessionUser = session?.user;
  const userId = sessionUser?.id;
  const openInbox = useCallback((pickupId?: string) => {
    if (pickupId) {
      setSelectedId(pickupId);
      setTab('handover');
      setDialog(undefined);
      setRevision((value) => value + 1);
    } else setDialog('activity');
  }, []);
  const inbox = useInbox(supabase, userId, dialog === 'activity');
  const push = useMobilePush(userId, openInbox);
  const notifications = [...inbox.notifications, ...sessionNotifications];
  const currentProfile = profile?.id === userId ? profile : null;
  const taker = currentProfile?.role === 'taker';
  const tab = requestedTab === 'give' && taker ? 'radar' : requestedTab === 'radar' && !taker ? 'give' : requestedTab;
  const canSeeTab = ({ value }: { value: Tab }) => value === 'give' ? !taker : value === 'radar' ? taker : true;
  const handovers = usePickupFeed({
    userId: tab === 'handover' || tab === 'profile' ? userId : undefined, mine: true, revision,
  });
  const recent = recentPickup && recentPickup.userId === userId && handovers.loading ? recentPickup.offer : undefined;
  const offers = recent ? [recent, ...handovers.offers.filter((offer) => offer.id !== recent.id)] : handovers.offers;
  useEffect(() => {
    const auth = supabase?.auth;
    if (!auth) return;
    const { data: { subscription } } = auth.onAuthStateChange((_event, nextSession) => {
      const id = nextSession?.user.id;
      if (id !== accountId.current) {
        if (accountId.current) setDraftReset((previous) => previous + 1);
        accountId.current = id;
        setProfile(null);
        setProfileError('');
        if (id === undefined) setSelectedId(undefined);
        setRecentPickup(undefined);
        setNotifications([]);
        setToast('');
        setActionError('');
      }
      setSession(nextSession);
      setAuthReady(true);
    });
    const activity = AppState.addEventListener('change', (state) => {
      if (state === 'active') void auth.startAutoRefresh();
      else void auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') void auth.startAutoRefresh();
    return () => {
      activity.remove();
      subscription.unsubscribe();
      void auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    let active = true;
    setProfileLoading(true);
    setProfileError('');
    loadProfile(sessionUser).then((result) => {
      if (active && accountId.current === result.id) setProfile(result);
    }).catch((cause) => {
      if (active && accountId.current === sessionUser.id) setProfileError(errorMessage(cause));
    }).finally(() => {
      if (active && accountId.current === sessionUser.id) setProfileLoading(false);
    });
    return () => { active = false; };
  }, [sessionUser, profileAttempt]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const refresh = () => setRevision((previous) => previous + 1);
  const openAccount = () => setDialog('account');

  function afterPublish(offer: PickupOffer) {
    if (!userId || accountId.current !== userId) return;
    setRadarReset((previous) => previous + 1);
    setTab('handover');
    setSelectedId(offer.id);
    setRecentPickup({ userId, offer });
    setToast('Listing published to Radar.');
    setNotifications((items) => [{
      id: offer.id, title: 'Listing published', message: offer.estimated_bottles + ' eligible containers in ' + offer.locality + '.',
      timestamp: 'Just now', read: false, type: 'pickup',
    }, ...items]);
    refresh();
  }

  async function updatePickup(offer: PickupOffer, status: Exclude<PickupStatus, 'open'>, code?: string) {
    if (!userId) { openAccount(); return; }
    if (status === 'reserved' && !taker) { setActionError('Switch to Taker to reserve pickups.'); return; }
    if (updating.current) return;
    updating.current = true;
    setBusy(true);
    setActionError('');
    try {
      const changed = await changePickup(offer.id, status, code);
      if (accountId.current !== userId) return;
      setRecentPickup({ userId, offer: changed });
      setSelectedId(changed.id);
      setTab('handover');
      setToast(status === 'completed' ? 'Handover recorded.' : status === 'reserved' ? 'Pickup reserved.' : 'Pickup updated.');
    } catch (cause) {
      if (accountId.current === userId) setActionError(errorMessage(cause));
    } finally {
      updating.current = false;
      setBusy(false);
      refresh();
    }
  }

  async function updateProfile(change: { avatar_url: string } | { role: 'giver' | 'taker' }) {
    if (!currentProfile || !userId || accountId.current !== userId) throw new Error('Sign in to update your profile.');
    if (savingProfile.current) throw new Error('A profile update is already in progress.');
    savingProfile.current = true;
    try {
      await saveProfile(currentProfile, change);
      if (accountId.current !== userId) return;
      setProfile((previous) => previous?.id === userId ? { ...previous, ...change } : previous);
      if ('role' in change) setTab(change.role === 'taker' ? 'radar' : 'give');
      else setToast('Profile photo updated.');
    } finally {
      savingProfile.current = false;
    }
  }

  function toggleRole() {
    if (!session) { openAccount(); return; }
    if (!currentProfile) { setTab('profile'); return; }
    setActionError('');
    void updateProfile({ role: taker ? 'giver' : 'taker' }).catch((cause) => setActionError(errorMessage(cause)));
  }

  async function logout() {
    setActionError('');
    try {
      await push.unregister().catch(() => {});
      await signOut();
      setToast('Signed out.');
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  }

  return <View style={appStyles.frame}>
    <LinearGradient pointerEvents="none" colors={['#0d1a32', colors.background]} style={appStyles.ambient} />
    <View style={appStyles.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => setTab('profile')}>
          <Avatar uri={currentProfile?.avatar_url} />
          <View style={[appStyles.dot, { backgroundColor: taker ? colors.green : colors.blue }]} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <Text accessibilityRole="header" weight="heavy" style={appStyles.brand}>BottleForMe</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={session ? 'Switch active role' : 'Log in'} onPress={toggleRole}>
              <Badge tone={taker ? 'green' : 'blue'} style={appStyles.role}>{taker ? '🚛 TAKER' : session ? '🎁 GIVER' : 'GUEST'}</Badge>
            </Pressable>
          </View>
          <Text weight="medium" style={styles.muted}>Plastic · Cans · Glass Collection</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" style={appStyles.iconButton} onPress={() => openInbox()}>
            <Bell size={16} color={colors.lightBlue} />
            {notifications.some((item) => !item.read) && <View style={appStyles.unread} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={session ? 'Profile' : 'Log in'} style={appStyles.iconButton}
            onPress={session ? () => setTab('profile') : openAccount}><User size={16} color={colors.lightBlue} /></Pressable>
        </View>
      </View>
      <Segmented options={primaryTabs.filter(canSeeTab)} value={tab} onChange={setTab} />
    </View>
    {maintenance && <View style={appStyles.alert}><ErrorText message="BottleForMe is under maintenance. Pickup changes are paused. Please try again shortly." /></View>}
    {actionError ? <View style={appStyles.alert}><ErrorText message={actionError} /></View> : null}
    {toast ? <View style={appStyles.toast} accessibilityLiveRegion="polite">
      <Check size={16} color={colors.green} />
      <Text weight="semibold" style={[styles.small, { flex: 1, color: '#b9f8d7' }]}>{toast}</Text>
    </View> : null}
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={tab === 'give' ? { flex: 1 } : { display: 'none' }}>
        <PostScreen key={draftReset} profile={currentProfile} signedIn={!!session} authReady={authReady}
          onSignIn={openAccount} onPublished={afterPublish} />
      </View>
      {tab === 'radar' && taker && <RadarScreen key={radarReset} revision={revision} busy={busy} onRefresh={refresh}
        onReserve={(offer) => void updatePickup(offer, 'reserved')} />}
      {tab === 'radar' && !taker && <View style={styles.scroll}>
        <Card>
          <Text weight="heavy" style={styles.title}>Radar is for Takers</Text>
          <Text style={styles.small}>Switch to Taker to see and reserve pickups from other accounts.</Text>
          <Button label={session ? 'Switch to Taker' : 'Sign in to use Radar'} onPress={toggleRole} />
        </Card>
      </View>}
      {tab === 'handover' && <HandoverScreen key={(userId ?? 'guest') + ':' + taker} userId={userId} taker={taker} revision={revision} offers={offers} loading={handovers.loading}
        error={handovers.error} busy={busy} selectedId={selectedId} onSelect={setSelectedId} onSignIn={openAccount}
        onRefresh={refresh} onChange={(offer, status, code) => void updatePickup(offer, status, code)} />}
      {tab === 'profile' && (authReady
        ? <ProfileScreen key={userId ?? 'guest'} profile={currentProfile} signedIn={!!session} loading={profileLoading}
          error={profileError} offers={offers} pickupsLoading={handovers.loading} onSignIn={openAccount}
          onRefresh={() => setProfileAttempt((previous) => previous + 1)} onSwitch={toggleRole}
          onAvatar={(avatar_url) => updateProfile({ avatar_url })} onSignOut={logout} />
        : <View style={styles.scroll}><Loading label="Restoring your account…" /></View>)}
    </KeyboardAvoidingView>
    <View accessibilityRole="tablist" style={appStyles.footer}>
      {tabs.filter(canSeeTab).map(({ value, label, Icon }) => <Pressable key={value} accessibilityRole="tab"
        accessibilityState={{ selected: tab === value }} onPress={() => setTab(value)} style={appStyles.tab}>
        <Icon size={16} color={tab === value ? colors.blue : colors.muted} />
        <Text weight="semibold" style={{ fontSize: 10, color: tab === value ? colors.white : colors.muted }}>{label}</Text>
      </Pressable>)}
    </View>
    {dialog === 'account' && <AccountDialog onClose={() => setDialog(undefined)} onSignedIn={(verified) => { setDialog(undefined); if (verified) setToast('Email verified. Signed in.'); }} />}
    {dialog === 'activity' && <Dialog title="Recent activity" onClose={() => setDialog(undefined)}>
      {userId && push.supported && <>
        <Button label={push.enabled ? 'Turn off lock screen alerts' : 'Enable lock screen alerts'} kind="secondary"
          disabled={push.busy} onPress={push.toggle} />
        <ErrorText message={push.error ?? ''} />
      </>}
      <ErrorText message={inbox.error ?? ''} />
      {notifications.some((item) => !item.read) && <Button label="Mark all as read" kind="secondary"
        onPress={() => {
          setNotifications((items) => items.map((item) => ({ ...item, read: true })));
          void inbox.markRead();
        }} />}
      {notifications.length ? notifications.map((item) => <Pressable key={item.id} disabled={!item.pickupId}
        accessibilityRole={item.pickupId ? 'button' : undefined} onPress={() => openInbox(item.pickupId)}
        style={[styles.inset, !item.read && { backgroundColor: '#102242' }]}>
        <Text weight="bold" style={styles.small}>{item.title}</Text>
        <Text style={styles.small}>{item.message}</Text>
        <Text style={styles.muted}>{item.timestamp}</Text>
      </Pressable>) : <Text style={styles.small}>No activity yet.</Text>}
    </Dialog>}
  </View>;
}

const appStyles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: colors.background, overflow: 'hidden' },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 225 },
  header: { paddingHorizontal: 16, paddingTop: 13, paddingBottom: 12, gap: 12 },
  brand: { color: colors.white, fontSize: 16, letterSpacing: -0.45 },
  role: { fontSize: 9, letterSpacing: 0.5, paddingVertical: 2, paddingHorizontal: 7 },
  dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.background, bottom: -1, right: -1 },
  iconButton: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.border,
    backgroundColor: '#11203a', alignItems: 'center', justifyContent: 'center',
  },
  unread: { position: 'absolute', width: 8, height: 8, borderRadius: 4, top: 4, right: 4, backgroundColor: colors.blue },
  alert: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: '#350f1a' },
  toast: {
    marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 16, borderWidth: 1,
    borderColor: colors.greenBorder, backgroundColor: colors.greenTint, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  footer: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 3, backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minHeight: 43, gap: 3, alignItems: 'center', justifyContent: 'center' },
});

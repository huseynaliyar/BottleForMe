import { useLanguage } from '../../lib/language-context';
import { useEffect, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Image, Linking, Platform, RefreshControl, ScrollView, View } from 'react-native';
import type { PickupRestriction } from '../../lib/pickup-restriction';
import { blockPickupExplanation } from '../../lib/marketplace-blocks';
import { usePickupPartner } from '../../lib/use-pickup-partner';
import { usePickupFavorites } from '../../lib/use-pickup-favorites';
import { bagPolicyLabel } from '../../lib/bag-policy';
import { pickupStatusColor, pickupStatusLightColor } from '../../lib/pickup-status';
import MapView, { Marker } from 'react-native-maps';
import { REVOLUT_TAG } from '../../lib/pickup-validation';
import { MALTA_LOCALITIES, type PickupOffer, type PickupStatus } from '../../lib/types';
import PickupChat from './PickupChat';
import PickupConversationCard from './PickupConversationCard';
import { EditPickupAvailability, PickupArrangements, PickupAvailability, RequestPickupTime } from './PickupSchedule';
import { blockPickupPartner, errorMessage, getHandoverCode, getListingPhoto, getPickupPartner, listPickups, loadFavorites, reportPickup, saveFavorite, setListingArchived, submitPickupReview } from './backend';
import { Badge, Button, Card, Dialog, ErrorText, localityOptions, Loading, Segmented, Select, Text, Field, useUi } from './ui';

type NextStatus = Exclude<PickupStatus, 'open'>;

const statusNames: Record<PickupStatus, string> = {
  open: 'Open', reserved: 'Reserved', en_route: 'On the way', arrived: 'Arrived', completed: 'Completed', cancelled: 'Cancelled',
};
const maltaRegion = { latitude: 35.97, longitude: 14.42, latitudeDelta: 0.23, longitudeDelta: 0.33 };
const canShowRadarMap = Platform.OS !== 'android' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient
  || Constants.expoConfig?.extra?.androidRadarMap === true;
const radarOptions = [{ label: 'Feed', value: 'list' }, { label: '🗺️ Map', value: 'map' }] as const;
const radarLocalities = [{ label: 'All localities', value: '' }, ...localityOptions];
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#172337' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a6bbd2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#172337' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#081326' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#39495f' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export function usePickupFeed({ locality = '', userId, mine = false, revision }: {
  locality?: string; userId?: string; mine?: boolean; revision: number;
}) {
  const scope = mine ? userId : locality;
  const [result, setResult] = useState<{ scope?: string; offers: PickupOffer[]; error: string }>({ offers: [], error: '' });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (mine && !userId) return;
    const controller = new AbortController();
    setLoading(true);
    const refreshPickups = () => listPickups(locality, mine, controller.signal).then((offers) => {
      if (!controller.signal.aborted) setResult({ scope, offers, error: '' });
    }).catch((cause) => {
      if (!controller.signal.aborted) setResult({ scope, offers: [], error: errorMessage(cause) });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    void refreshPickups();
    const timer = mine ? setInterval(refreshPickups, 30_000) : undefined;
    return () => { clearInterval(timer); controller.abort(); };
  }, [locality, mine, revision, scope, userId]);

  return {
    offers: result.scope === scope ? result.offers : [],
    error: result.scope === scope && !loading ? result.error : '',
    loading: (!mine || !!userId) && (loading || result.scope !== scope),
  };
}

const ratings = [5, 4, 3, 2, 1].map((value) => ({ label: String(value), value: String(value) }));

function PickupPartner({ pickupId }: { pickupId: string }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const info = usePickupPartner(pickupId, getPickupPartner, submitPickupReview);
  const { partner } = info;
  const [blocked, setBlocked] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockError, setBlockError] = useState('');

  async function block() {
    setBlocking(true);
    setBlockError('');
    try { await blockPickupPartner(pickupId); setBlocked(true); }
    catch (cause) { setBlockError(errorMessage(cause)); }
    finally { setBlocking(false); }
  }

  const isBlocked = blocked || partner?.blockedByYou;
  return <View style={styles.inset}>
    <Text weight="bold" style={styles.body}>{t("Pickup partner")}</Text>
    {partner ? <>
      <Text style={styles.body}>{partner.name} · {t(partner.role)}</Text>
      <Text style={styles.small}>{partner.count ? `${partner.average}/5 · ${partner.count} ratings` : t("No ratings yet")}</Text>
      {partner.phone && !isBlocked && <Text style={styles.small}>Phone · {partner.phone}</Text>}
      {isBlocked ? <Text style={styles.small}>You blocked this account. Manage it in Settings.</Text>
        : <Button label={t("Block account")} kind="quiet" disabled={blocking} onPress={() => Alert.alert(
          'Block account?', blockPickupExplanation, [{ text: 'Cancel', style: 'cancel' }, {
            text: 'Block', style: 'destructive', onPress: () => void block(),
          }],
        )} />}
      <ErrorText message={blockError} />
      {partner.reviewReceived && <>
        <Text weight="bold" style={styles.small}>Your partner’s review · {partner.reviewReceived.stars}/5</Text>
        <Text style={styles.small}>{partner.reviewReceived.comment}</Text>
      </>}
      {partner.canReview && <>
        <Select label={t("Your rating out of five")} value={String(info.stars)} options={ratings} onChange={(value) => info.setStars(Number(value))} />
        <Field label={t("Review (optional)")} multiline maxLength={500} value={info.comment} onChangeText={info.setComment} />
        <Button label={info.saving ? t("Saving…") : partner.reviewGiven ? t("Update review") : t("Submit review")} kind="secondary"
          disabled={info.saving} onPress={() => void info.save()} />
        {info.saved && <Text accessibilityLiveRegion="polite" style={styles.small}>{t("Review saved.")}</Text>}
      </>}
    </> : !info.error && <Text style={styles.small}>Loading pickup partner…</Text>}
    <ErrorText message={info.error} />
  </View>;
}

function PickupPhoto({ pickupId }: { pickupId: string }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [photo, setPhoto] = useState<string | null>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function show() {
    setLoading(true);
    setError('');
    try { setPhoto((await getListingPhoto(pickupId)).photo); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }

  if (photo === null) return <Text style={styles.small}>{t("This listing has no photo.")}</Text>;
  if (photo) return <Image source={{ uri: photo }} accessibilityLabel="Bottles or bags for this pickup"
    resizeMode="contain" style={{ width: '100%', height: 210 }} />;
  return <>
    <Button label={loading ? t("Loading photo…") : t("Show listing photo")} disabled={loading} kind="secondary" onPress={() => void show()} />
    <ErrorText message={error} />
  </>;
}

function ReportButton({ pickupId, target }: { pickupId: string; target: 'listing' | 'user' }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const label = target === 'user' ? 'Report pickup partner' : 'Report listing';

  async function submit() {
    if (busy || sent || reason.trim().length < 10) return;
    setBusy(true);
    setError('');
    try { await reportPickup(pickupId, target, reason); setSent(true); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <Button label={t(label)} kind="quiet" onPress={() => { setReason(''); setError(''); setSent(false); setOpen(true); }} />
    {open && <Dialog title={t(label)} onClose={() => setOpen(false)}>
      {sent ? <Text style={styles.body}>{t("Report sent to the BottleForMe team.")}</Text> : <>
        <Field label={t("Describe the issue")} value={reason} onChangeText={setReason} maxLength={500} multiline />
        <Text style={styles.small}>Use 10–500 characters. Do not include passwords, handover codes or payment details.</Text>
        <ErrorText message={error} />
        <Button label={busy ? t("Sending…") : t("Submit report")} disabled={busy || reason.trim().length < 10} onPress={submit} />
      </>}
    </Dialog>}
  </>;
}

export function RadarScreen({ userId, revision, busy, onReserve, onRefresh, onRestriction }: {
  userId?: string; revision: number; busy: boolean; onReserve: (offer: PickupOffer) => void; onRefresh: () => void;
  onRestriction: (restriction: PickupRestriction) => void;
}) {
  const { t } = useLanguage();
  const { colors, styles, theme } = useUi();
  const [locality, setLocality] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const { offers: allOffers, loading, error } = usePickupFeed({ locality, revision });
  const favorites = usePickupFavorites(userId, loadFavorites, saveFavorite);
  const [savedOnly, setSavedOnly] = useState(false);
  const offers = savedOnly ? allOffers.filter((offer) => favorites.ids?.includes(offer.id)) : allOffers;
  const markers = MALTA_LOCALITIES.map((place) => ({
    ...place, count: offers.filter((offer) => offer.locality === place.name).length,
  })).filter((place) => place.count > 0);

  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh}
    tintColor={colors.sky} colors={[colors.blue]} progressBackgroundColor={colors.panel} />}>
    <Card>
      <View style={styles.between}>
        <View style={{ flexShrink: 1 }}>
          <Text weight="bold" style={styles.eyebrow}>{t("Malta Collector Radar")}</Text>
          <Text accessibilityRole="header" weight="bold" style={[styles.title, { fontSize: 16 }]}>{offers.length}{' ' + t("Live Pickup Requests")}</Text>
        </View>
        {canShowRadarMap && <Segmented options={radarOptions} value={view} onChange={setView} compact />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Select label={t("Filter Radar by locality")} value={locality} options={radarLocalities} onChange={setLocality} style={{ flex: 1 }} />
        <Button label={t("Refresh")} kind="secondary" onPress={onRefresh} />
      </View>
      <Button label={savedOnly ? t("Show all listings") : t("Show saved listings")} kind="secondary"
        disabled={!favorites.ids} onPress={() => setSavedOnly(!savedOnly)} />
      <ErrorText message={favorites.error} />
      {loading && <Loading label="Loading Radar…" />}
      <ErrorText message={error} />
      {!loading && !error && offers.length === 0 && <Text style={styles.muted}>{savedOnly ? t("No saved listings in this area.") : t("No available pickups in this area.")}</Text>}
      {canShowRadarMap && view === 'map' && <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <MapView style={{ height: 270 }} initialRegion={maltaRegion} userInterfaceStyle={theme} customMapStyle={theme === 'dark' ? mapStyle : undefined}
          accessibilityLabel="Map of pickup localities">
          {markers.map((place) => <Marker key={place.id} title={place.name}
            description={place.count + (place.count === 1 ? ' available pickup' : ' available pickups')}
            coordinate={{ latitude: place.lat, longitude: place.lng }} pinColor={colors.blue}
            onCalloutPress={() => setLocality(place.name)} />)}
        </MapView>
      </View>}
    </Card>
    {offers.map((offer) => <Card key={offer.id} style={{ borderRadius: 24, padding: 14 }}>
      <View style={styles.between}>
        <View style={{ flexShrink: 1, gap: 5 }}>
          <View style={styles.row}>
            <Badge>{offer.locality}</Badge>
            <Badge tone={offer.split_percentage === 0 ? 'green' : 'neutral'}>
              {offer.split_percentage === 0 ? '100% Free' : offer.split_percentage + '% Split'}
            </Badge>
          </View>
          <Text weight="bold" style={styles.body}>{offer.containers ? '' : 'About '}{offer.estimated_bottles} containers · {offer.bag_count} {offer.bag_count === 1 ? 'bag' : 'bags'}</Text>
        </View>
        <View>
          <Text weight="medium" style={styles.muted}>{t("Collector’s estimated net value")}</Text>
          <Text weight="heavy" style={{ color: colors.green, fontSize: 16 }}>€{offer.collector_profit.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[styles.between, styles.rule]}>
        <Text style={styles.muted}>{t("Pay Giver:") + ' '}<Text weight="bold">€{offer.seller_payout.toFixed(2)}</Text></Text>
        {!offer.availability?.length && <Button label={t("Reserve pickup →")} kind="secondary" onPress={() => onReserve(offer)} disabled={busy || loading} />}
      </View>
      <Text style={styles.small}>{t(bagPolicyLabel(offer.bag_policy))}</Text>
      <Button label={favorites.ids?.includes(offer.id) ? t("Remove favorite") : t("Save favorite")} kind="secondary"
        disabled={!favorites.ids || favorites.busy} onPress={() => void favorites.toggle(offer.id)} />
      <PickupPhoto pickupId={offer.id} />
      <ReportButton pickupId={offer.id} target="listing" />
      {offer.availability?.length ? <>
        <PickupAvailability offer={offer} />
        <RequestPickupTime offer={offer} onSaved={onRefresh} onRestriction={onRestriction} />
      </> : null}
    </Card>)}
  </ScrollView>;
}

export function HandoverScreen({ userId, taker, revision, offers, loading, error, busy, selectedId, chatOpen, unread, onChat, onRead,
  onSelect, onSignIn, onRefresh, onSwitchRole, onChange }: {
  userId?: string; taker: boolean; revision: number; offers: PickupOffer[]; loading: boolean; error: string; busy: boolean; selectedId?: string;
  chatOpen: boolean; unread: Map<string, number>; onChat: (id?: string) => void; onRead: () => void;
  onSelect: (id?: string) => void; onSignIn: () => void; onRefresh: () => void; onSwitchRole: () => void; onChange: (offer: PickupOffer, status: NextStatus, code?: string) => void;
}) {
  const { t } = useLanguage();
  const { colors, styles, theme } = useUi();
  const [linkError, setLinkError] = useState('');
  const [handoverCode, setHandoverCode] = useState<{ id: string; value: string }>();
  const [typedCode, setTypedCode] = useState<{ id: string; value: string }>();
  const participantKey = taker ? 'collector_id' : 'seller_id';
  const roleOffers = offers.filter((offer) => offer[participantKey] === userId);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const visibleOffers = taker ? roleOffers : roleOffers.filter((offer) => !!offer.archived_at === showArchived);

  async function toggleArchive(offer: PickupOffer) {
    if (archiving) return;
    setArchiving(true);
    setLinkError('');
    try { await setListingArchived(offer.id, !offer.archived_at); onRefresh(); }
    catch (cause) { setLinkError(errorMessage(cause)); }
    finally { setArchiving(false); }
  }
  const selected = roleOffers.find((offer) => offer.id === selectedId);
  const selectedInOtherRole = !selected && !!selectedId && offers.some((offer) => offer.id === selectedId);
  const active = selected?.status === 'reserved' || selected?.status === 'en_route' || selected?.status === 'arrived';
  const collector = !!selected && selected.collector_id === userId;

  function confirm(offer: PickupOffer, status: 'completed' | 'cancelled') {
    const label = status === 'completed' ? 'Record handover' : 'Cancel pickup';
    Alert.alert(label, status === 'completed' ? 'Confirm that the handover is complete.' : 'This will close the pickup.', [
      { text: 'Go back', style: 'cancel' },
      { text: label, style: status === 'cancelled' ? 'destructive' : 'default', onPress: () => onChange(offer, status) },
    ]);
  }

  function backToPickups() {
    setLinkError(''); setHandoverCode(undefined); setTypedCode(undefined); onSelect();
  }

  if (selected && chatOpen && selected.collector_id && selected.seller_id) {
    return <PickupChat key={selected.id} offer={selected} taker={taker} onRead={onRead}
      onBack={backToPickups} onDetails={() => onChat()} />;
  }

  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={userId
    ? <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.sky} /> : undefined}>
    <View style={selectedId ? undefined : { gap: 10 }}>
      <Text accessibilityRole="header" weight="heavy" style={[styles.title, { textAlign: 'center', marginVertical: 6 }]}>
        {t(selectedId ? 'Pickup details' : 'Pickups')}
      </Text>
      {!userId ? <Button label={t("Sign in to view pickups")} onPress={onSignIn} style={{ alignSelf: 'flex-start' }} /> : <>
        {selectedId ? <Button label={t('← All pickups')} kind="secondary" onPress={backToPickups} /> : null}
        {loading && <Loading label={t("Loading your pickups…")} />}
        <ErrorText message={error} />
        {!selectedId && !taker && <Button kind="secondary" label={showArchived ? t("Show current listings") : t("Show archived listings")}
          onPress={() => setShowArchived(!showArchived)} />}
        {!selectedId && !loading && !visibleOffers.length && <Text style={styles.small}>{showArchived && !taker ? t("No archived listings yet.") : t("No pickups in this role yet.")}</Text>}
        {!selectedId && visibleOffers.map((offer) => <PickupConversationCard key={offer.id} offer={offer} taker={taker}
          status={t(!taker && offer.archived_at ? 'Archived' : offer.overdue ? 'Overdue' : statusNames[offer.status])}
          unread={unread.get(offer.id)} onOpen={() => {
            setLinkError(''); onSelect(offer.id);
            if (offer.collector_id && offer.seller_id) onChat(offer.id);
          }} />)}
        {selectedInOtherRole ? <Button label={taker ? 'Switch to Giver to view pickup' : 'Switch to Taker to view pickup'} onPress={onSwitchRole} /> :
        <PickupArrangements key={selectedId ?? 'list'} userId={userId} participantKey={participantKey} listingId={selectedId} revision={revision}
          onSaved={onRefresh} onOpen={selectedId ? undefined : onSelect} />}
        {selected && <Card>
          <Text weight="semibold" style={styles.body}>{selected.seller_name} · {selected.locality}</Text>
          <Text style={[styles.small, { color: selected.overdue ? colors.red : theme === 'light' ? pickupStatusLightColor[selected.status] : pickupStatusColor[selected.status] }]}>Status · {!taker && selected.archived_at ? t("Archived") : selected.overdue ? t("Overdue") : t(statusNames[selected.status])}</Text>
          {!taker && !active && selected.seller_id === userId && <Button label={selected.archived_at ? t("Restore listing") : t("Archive listing")}
            kind="secondary" disabled={archiving} onPress={() => void toggleArchive(selected)} />}
          {selected.collector_id && <Button kind="secondary"
            label={(active ? t("Open chat") : t("Chat history")) + (unread.get(selected.id) ? ' · ' + unread.get(selected.id) + ' unread' : '')}
            onPress={() => onChat(selected.id)} />}
          <PickupAvailability offer={selected} />
          {selected.collector_id && selected.seller_id && <PickupPartner key={selected.id + ':' + selected.status} pickupId={selected.id} />}
          {selected.collector_id && selected.seller_id && <ReportButton key={selected.id} pickupId={selected.id} target="user" />}
          <Text style={styles.small}>{t(bagPolicyLabel(selected.bag_policy))}</Text>
          <PickupPhoto key={'photo:' + selected.id} pickupId={selected.id} />
          {selected.status === 'open' && selected.seller_id === userId && <EditPickupAvailability key={selected.id + ':' + (selected.availability_version ?? 0)} offer={selected} onSaved={onRefresh} />}
          {!!selected.address_notes && <Text style={styles.small}>{selected.address_notes}</Text>}
          <Text style={styles.small}>{selected.seller_payout === 0 ? t("Free pickup") :
            'Pay the seller €' + selected.seller_payout.toFixed(2) + (selected.payout_method === 'revolut' ? ' via Revolut.' :
              selected.payout_method === 'cash' ? ' in cash.' : ' as agreed.')}</Text>
          {collector && active && selected.seller_payout > 0 && selected.payout_method === 'revolut'
            && selected.seller_revolut_tag && REVOLUT_TAG.test(selected.seller_revolut_tag) && <Button label={t("Open Revolut")}
              kind="secondary" onPress={() => {
                const tag = encodeURIComponent(selected.seller_revolut_tag!.replace(/^@/, ''));
                Linking.openURL('https://revolut.me/' + tag + '?amount=' + selected.seller_payout.toFixed(2))
                  .catch(() => setLinkError('Could not open Revolut.'));
              }} style={{ alignSelf: 'flex-start' }} />}
          <ErrorText message={linkError} />
          {active && (collector ? <>
            <Field label={t("Six-digit code shown by the Giver")} keyboardType="number-pad" maxLength={6}
              value={typedCode?.id === selected.id ? typedCode.value : ''}
              onChangeText={(value) => setTypedCode({ id: selected.id, value: value.replace(/\D/g, '').slice(0, 6) })} />
            <Button label={t("Complete handover")} disabled={busy || typedCode?.id !== selected.id || typedCode.value.length !== 6}
              onPress={() => onChange(selected, 'completed', typedCode?.value)} />
          </> : <>
            <Button label={t("Show handover code")} onPress={() => {
              setLinkError('');
              getHandoverCode(selected.id).then(({ code }) => setHandoverCode({ id: selected.id, value: code }))
                .catch((cause) => setLinkError(cause instanceof Error ? cause.message : 'Could not show the code.'));
            }} />
            {handoverCode?.id === selected.id && <Text weight="heavy" style={styles.title}>Show the Taker: {handoverCode.value}</Text>}
          </>)}
          <View style={styles.row}>
            {collector && selected.status === 'reserved' && <Button label={t("Mark on the way")} kind="secondary" disabled={busy}
              onPress={() => onChange(selected, 'en_route')} />}
            {collector && selected.status === 'en_route' && <Button label={t("Mark arrived")} kind="secondary" disabled={busy}
              onPress={() => onChange(selected, 'arrived')} />}
            {(active || selected.status === 'open') && <Button label={t("Cancel pickup")} kind="quiet" disabled={busy}
              onPress={() => confirm(selected, 'cancelled')} />}
          </View>
          <Text style={styles.muted}>Users arrange and verify payment directly.</Text>
        </Card>}
      </>}
    </View>
  </ScrollView>;
}

import { useLanguage } from '../../lib/language-context';
import { useEffect, useState } from 'react';
import { canShowPickupMap } from './map-support';
import { pickupMapUrl, pickupStep, pickupSteps, radarPins } from '../../lib/pickup-location';
import { pickupConversationTitle } from '../../lib/pickup-conversation';
import { Alert, Image, Linking, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import type { PickupRestriction } from '../../lib/pickup-restriction';
import { blockPickupExplanation } from '../../lib/marketplace-blocks';
import { usePickupPartner } from '../../lib/use-pickup-partner';
import { usePickupFavorites } from '../../lib/use-pickup-favorites';
import { bagPolicyLabel } from '../../lib/bag-policy';
import { pickupStatusColor, pickupStatusLightColor } from '../../lib/pickup-status';
import MapView, { Marker } from 'react-native-maps';
import { formatAppointment } from '../../lib/pickup-schedule';
import { REVOLUT_TAG } from '../../lib/pickup-validation';
import { type PickupOffer, type PickupStatus } from '../../lib/types';
import PickupChat, { PickupChatFallback } from './PickupChat';
import PickupConversationCard, { PickupAvatar } from './PickupConversationCard';
import { EditPickupAvailability, PickupArrangements, PickupAvailability, RequestPickupTime } from './PickupSchedule';
import { blockPickupPartner, errorMessage, getHandoverCode, getListingPhoto, getPickupPartner, listPickups, loadFavorites, reportPickup, saveFavorite, setListingArchived, submitPickupReview } from './backend';
import { Badge, Button, Card, Dialog, ErrorText, localityOptions, Loading, Segmented, Select, Text, Field, useUi } from './ui';

type NextStatus = Exclude<PickupStatus, 'open'>;

const statusNames: Record<PickupStatus, string> = {
  open: 'Open', reserved: 'Reserved', en_route: 'On the way', arrived: 'Arrived', completed: 'Completed', cancelled: 'Cancelled',
};
const maltaRegion = { latitude: 35.97, longitude: 14.42, latitudeDelta: 0.23, longitudeDelta: 0.33 };
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
  const [view, setView] = useState<'list' | 'map'>(canShowPickupMap ? 'map' : 'list');
  const [mapOfferId, setMapOfferId] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const { height } = useWindowDimensions();
  const { offers: allOffers, loading, error } = usePickupFeed({ locality, revision });
  const favorites = usePickupFavorites(userId, loadFavorites, saveFavorite);
  const [savedOnly, setSavedOnly] = useState(false);
  const offers = savedOnly ? allOffers.filter((offer) => favorites.ids?.includes(offer.id)) : allOffers;
  const markers = radarPins(offers);
  const group = markers.find(([key]) => key === groupId)?.[1];
  const shownOffers = view === 'map' ? offers.filter((offer) => offer.id === mapOfferId) : offers;

  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh}
    tintColor={colors.sky} colors={[colors.blue]} progressBackgroundColor={colors.panel} />}>
    <Card>
      <View style={styles.between}>
        <View style={{ flexShrink: 1 }}>
          <Text weight="bold" style={styles.eyebrow}>{t("Malta Collector Radar")}</Text>
          <Text accessibilityRole="header" weight="bold" style={[styles.title, { fontSize: 16 }]}>{offers.length}{' ' + t("Live Pickup Requests")}</Text>
        </View>
        {canShowPickupMap && <Segmented options={radarOptions} value={view} onChange={setView} compact />}
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
      {canShowPickupMap && view === 'map' && <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <MapView style={{ height: Math.max(230, height * 0.38) }} initialRegion={maltaRegion} userInterfaceStyle={theme} customMapStyle={theme === 'dark' ? mapStyle : undefined}
          accessibilityLabel="Map of pickup localities">
          {markers.map(([key, { pin, name, offers: matching }]) => <Marker key={key} accessibilityLabel={name + ': ' + matching.length + ' pickups'}
            coordinate={{ latitude: pin.lat, longitude: pin.lng }} pinColor={colors.blue}
            onPress={() => { setGroupId(matching.length > 1 ? key : undefined); setMapOfferId(matching.length === 1 ? matching[0].id : undefined); }} />)}
        </MapView>
      </View>}
    </Card>
    {view === 'map' && !mapOfferId && group && <Card>
      <Text weight="bold" style={styles.body}>{group.name}</Text>
      {group.offers.map((offer) => <Button key={offer.id} kind="secondary" label={offer.estimated_bottles + ' containers · €' + offer.collector_profit.toFixed(2)} onPress={() => setMapOfferId(offer.id)} />)}
    </Card>}
    {shownOffers.map((offer) => <Card key={offer.id} style={{ borderRadius: 24, padding: 14 }}>
      {view === 'map' && <View style={styles.between}><View><Badge tone="green">{t('Available')}</Badge><Text weight="bold" style={styles.body}>{offer.locality} {t('pickup')}</Text></View><Button label={t('Close')} kind="quiet" onPress={() => { setMapOfferId(undefined); setGroupId(undefined); }} /></View>}
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
          <Text weight="medium" style={styles.muted}>{t(view === 'map' ? 'Est. you earn' : 'Collector’s estimated net value')}</Text>
          <Text weight="heavy" style={{ color: colors.green, fontSize: 16 }}>€{offer.collector_profit.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[styles.between, styles.rule]}>
        <Text style={styles.muted}>{t("Pay Giver:") + ' '}<Text weight="bold">€{offer.seller_payout.toFixed(2)}</Text></Text>
        {!offer.availability?.length && <Button label={t("Reserve pickup →")} kind="secondary" onPress={() => onReserve(offer)} disabled={busy || loading} />}
      </View>
      {view === 'map' && <Text style={styles.small}>{t(offer.exact_pin ? 'Exact pin shared · Address after confirmation' : 'Approximate location · Address after confirmation')}</Text>}
      <Text style={styles.small}>{t(bagPolicyLabel(offer.bag_policy))}</Text>
      <Button label={favorites.ids?.includes(offer.id) ? t("Remove favorite") : t("Save favorite")} kind="secondary"
        disabled={!favorites.ids || favorites.busy} onPress={() => void favorites.toggle(offer.id)} />
      <PickupPhoto pickupId={offer.id} />
      <ReportButton pickupId={offer.id} target="listing" />
      {offer.availability?.length ? <>
        {view === 'list' && <PickupAvailability offer={offer} />}
        <RequestPickupTime offer={offer} triggerLabel={view === 'map' ? 'Choose pickup time' : undefined} onSaved={onRefresh} onRestriction={onRestriction} />
      </> : null}
    </Card>)}
  </ScrollView>;
}

export function HandoverScreen({ userId, taker, revision, offers, loading, error, busy, selectedId, chatOpen, chatLoading, unread, onChat, onRead,
  onSelect, onSignIn, onRefresh, onSwitchRole, onChange }: {
  userId?: string; taker: boolean; revision: number; offers: PickupOffer[]; loading: boolean; error: string; busy: boolean; selectedId?: string;
  chatOpen: boolean; chatLoading: boolean; unread: Map<string, number>; onChat: (id?: string) => void; onRead: () => void;
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

  const [moreFor, setMoreFor] = useState<string>();
  const [cancelFor, setCancelFor] = useState<string>();
  const mapUrl = selected && active ? pickupMapUrl(selected) : null;

  function backToPickups() {
    setLinkError(''); setHandoverCode(undefined); setTypedCode(undefined); setMoreFor(undefined); setCancelFor(undefined); onSelect();
  }

  if (selected && chatOpen && selected.collector_id && selected.seller_id) {
    return <PickupChat key={selected.id} offer={selected} taker={taker} onRead={onRead}
      onBack={backToPickups} onDetails={() => onChat()} />;
  }

  if (chatOpen) return <PickupChatFallback onBack={backToPickups}
    message={t(chatLoading ? 'Loading chat…' : !userId ? 'Sign in to view pickups' : 'Pickup chat unavailable')}
    action={chatLoading ? undefined : !userId ? { label: t('Log in'), run: onSignIn }
      : selected || selectedInOtherRole ? { label: t('Pickup details'), run: () => onChat() } : undefined} />;

  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={userId
    ? <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.sky} /> : undefined}>
    <View style={selectedId ? undefined : { gap: 10 }}>
      <Text accessibilityRole="header" weight="heavy" style={[styles.title, { textAlign: 'center', marginVertical: 6 }]}>
        {t(active ? 'Manage pickup' : selectedId ? 'Pickup details' : 'Pickups')}
      </Text>
      {!userId ? <Button label={t("Sign in to view pickups")} onPress={onSignIn} style={{ alignSelf: 'flex-start' }} /> : <>
        {selectedId ? <Button label={t('← All pickups')} kind="secondary" onPress={backToPickups} /> : null}
        {loading && <Loading label={t("Loading your pickups…")} />}
        <ErrorText message={error} />
        {!selectedId && !taker && <Button kind="secondary" label={showArchived ? t("Show current listings") : t("Show archived listings")}
          onPress={() => setShowArchived(!showArchived)} />}
        {!selectedId && visibleOffers.map((offer) => <PickupConversationCard key={offer.id} offer={offer} taker={taker}
          status={t(!taker && offer.archived_at ? 'Archived' : offer.overdue ? 'Overdue' : statusNames[offer.status])}
          unread={unread.get(offer.id)} onOpen={() => {
            setLinkError(''); onSelect(offer.id);
            if (offer.collector_id && offer.seller_id) onChat(offer.id);
          }} />)}
        {selectedInOtherRole ? <Button label={taker ? 'Switch to Giver to view pickup' : 'Switch to Taker to view pickup'} onPress={onSwitchRole} /> :
        !active && <PickupArrangements key={selectedId ?? 'list'} userId={userId} participantKey={participantKey} listingId={selectedId} revision={revision}
          onSaved={onRefresh} onOpen={selectedId ? undefined : onSelect} excludeFor={new Set(roleOffers.map((offer) => offer.id))} hideListEntries={showArchived && !taker}
          emptyListMessage={!loading && !visibleOffers.length ? (showArchived && !taker ? 'No archived listings yet.' : 'No pickups in this role yet.') : undefined} />}
        {selected && <Card>
          <View style={styles.row}>
            {!!selected.collector_id && !!selected.seller_id && <PickupAvatar name={pickupConversationTitle(selected, taker, t)} pickupId={selected.id} />}
            <Text weight="semibold" style={[styles.body, { flex: 1 }]}>{selected.collector_id ? pickupConversationTitle(selected, taker, t) : selected.locality}</Text>
          </View>
          <Text style={[styles.small, { color: selected.overdue ? colors.red : theme === 'light' ? pickupStatusLightColor[selected.status] : pickupStatusColor[selected.status] }]}>Status · {!taker && selected.archived_at ? t("Archived") : selected.overdue ? t("Overdue") : t(statusNames[selected.status])}</Text>
          {!taker && !active && selected.seller_id === userId && <Button label={selected.archived_at ? t("Restore listing") : t("Archive listing")}
            kind="secondary" disabled={archiving} onPress={() => void toggleArchive(selected)} />}
          {!!selected.confirmed_at && <Text style={styles.body}>{formatAppointment(selected.confirmed_at)} · Malta time</Text>}
          {active && !!selected.address_notes && <Text style={styles.body}>{selected.address_notes}</Text>}
          {mapUrl && <Button label={t('Open in Maps')} kind="quiet" onPress={() => void Linking.openURL(mapUrl).catch(() => setLinkError('Could not open the map.'))} />}
          {active && <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
            {pickupSteps.map((label, index) => <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Badge tone={index <= pickupStep(selected.status) ? undefined : 'neutral'}>{index + 1}</Badge>
              <Text style={[styles.small, { textAlign: 'center' }]}>{t(label)}</Text>
            </View>)}
          </View>}
          {active && <Card style={{ gap: 8 }}>
            <Text weight="bold" style={styles.body}>{t('Next step')}</Text>
            <Text style={styles.small}>{t(!collector ? 'Show the handover code to the Taker at the pickup.' : selected.status === 'reserved' ? 'Let the Giver know when you leave.' : selected.status === 'en_route' ? 'Let the Giver know when you reach the address.' : 'Ask the Giver for the six-digit code to complete your pickup.')}</Text>
            {collector && selected.status === 'reserved' && <Button label={t('I’m on my way')} disabled={busy} onPress={() => onChange(selected, 'en_route')} />}
            {collector && selected.status === 'en_route' && <Button label={t('I’ve arrived')} onPress={() => onChange(selected, 'arrived')} />}
            {collector && selected.status === 'arrived' && <>
              <Field label={t('Six-digit code shown by the Giver')} keyboardType="number-pad" maxLength={6} value={typedCode?.id === selected.id ? typedCode.value : ''}
                onChangeText={(value) => setTypedCode({ id: selected.id, value: value.replace(/\D/g, '').slice(0, 6) })} />
              <Button label={t('Complete handover')} disabled={busy || typedCode?.id !== selected.id || typedCode.value.length !== 6}
                onPress={() => onChange(selected, 'completed', typedCode?.value)} />
            </>}
            {!collector && <>
              <Button label={t('Show handover code')} onPress={() => {
                setLinkError('');
                getHandoverCode(selected.id).then(({ code }) => setHandoverCode({ id: selected.id, value: code }))
                  .catch((cause) => setLinkError(errorMessage(cause)));
              }} />
              {handoverCode?.id === selected.id && <Text weight="heavy" style={styles.title}>Show the Taker: {handoverCode.value}</Text>}
            </>}
          </Card>}
          {selected.collector_id && <Button kind="secondary"
            label={(active ? t("Open chat") : t("Chat history")) + (unread.get(selected.id) ? ' · ' + unread.get(selected.id) + ' unread' : '')}
            onPress={() => onChat(selected.id)} />}
          <Button label={t(moreFor === selected.id ? 'Hide options' : 'More options')} kind="quiet"
            onPress={() => { setMoreFor(moreFor === selected.id ? undefined : selected.id); setCancelFor(undefined); }} />
          {moreFor === selected.id && <>
          {!active && <PickupAvailability offer={selected} />}
          {selected.collector_id && selected.seller_id && <PickupPartner key={selected.id + ':' + selected.status} pickupId={selected.id} />}
          {selected.collector_id && selected.seller_id && <ReportButton key={selected.id} pickupId={selected.id} target="user" />}
          <Text style={styles.small}>{t(bagPolicyLabel(selected.bag_policy))}</Text>
          <PickupPhoto key={'photo:' + selected.id} pickupId={selected.id} />
          {selected.status === 'open' && selected.seller_id === userId && <EditPickupAvailability key={selected.id + ':' + (selected.availability_version ?? 0)} offer={selected} onSaved={onRefresh} />}
          {!active && !!selected.address_notes && <Text style={styles.small}>{selected.address_notes}</Text>}
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
          {(active || selected.status === 'open') && <Button label={t('Cancel pickup')} kind="quiet" disabled={busy}
            onPress={() => setCancelFor(cancelFor === selected.id ? undefined : selected.id)} />}
          {cancelFor === selected.id && (active || selected.status === 'open') && <View style={styles.inset}>
            <Text style={styles.small}>{t('Cancelling closes this pickup for both people.')}</Text>
            <Button label={t('Confirm cancellation')} kind="secondary" disabled={busy} onPress={() => onChange(selected, 'cancelled')} />
          </View>}
          <Text style={styles.muted}>Users arrange and verify payment directly.</Text>
          </>}
          <ErrorText message={linkError} />
        </Card>}
      </>}
    </View>
  </ScrollView>;
}

import { useEffect, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Linking, Platform, RefreshControl, ScrollView, View, Pressable } from 'react-native';
import { bagPolicyLabel } from '../../lib/bag-policy';
import { pickupStatusColor } from '../../lib/pickup-status';
import MapView, { Marker } from 'react-native-maps';
import { REVOLUT_TAG } from '../../lib/pickup-validation';
import { MALTA_LOCALITIES, type PickupOffer, type PickupStatus } from '../../lib/types';
import { EditPickupAvailability, PickupArrangements, PickupAvailability, RequestPickupTime } from './PickupSchedule';
import { errorMessage, getHandoverCode, listPickups } from './backend';
import { Badge, Button, Card, colors, ErrorText, localityOptions, Loading, Segmented, Select, styles, Text, Field } from './ui';

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
    listPickups(locality, mine, controller.signal).then((offers) => {
      if (!controller.signal.aborted) setResult({ scope, offers, error: '' });
    }).catch((cause) => {
      if (!controller.signal.aborted) setResult({ scope, offers: [], error: errorMessage(cause) });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [locality, mine, revision, scope, userId]);

  return {
    offers: result.scope === scope ? result.offers : [],
    error: result.scope === scope && !loading ? result.error : '',
    loading: (!mine || !!userId) && (loading || result.scope !== scope),
  };
}

export function RadarScreen({ revision, busy, onReserve, onRefresh }: {
  revision: number; busy: boolean; onReserve: (offer: PickupOffer) => void; onRefresh: () => void;
}) {
  const [locality, setLocality] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const { offers, loading, error } = usePickupFeed({ locality, revision });
  const markers = MALTA_LOCALITIES.map((place) => ({
    ...place, count: offers.filter((offer) => offer.locality === place.name).length,
  })).filter((place) => place.count > 0);

  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh}
    tintColor={colors.sky} colors={[colors.blue]} progressBackgroundColor={colors.panel} />}>
    <Card>
      <View style={styles.between}>
        <View style={{ flexShrink: 1 }}>
          <Text weight="bold" style={styles.eyebrow}>Malta Collector Radar</Text>
          <Text accessibilityRole="header" weight="bold" style={[styles.title, { fontSize: 16 }]}>{offers.length} Live Pickup Requests</Text>
        </View>
        {canShowRadarMap && <Segmented options={radarOptions} value={view} onChange={setView} compact />}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Select label="Filter Radar by locality" value={locality} options={radarLocalities} onChange={setLocality} style={{ flex: 1 }} />
        <Button label="Refresh" kind="secondary" onPress={onRefresh} />
      </View>
      {loading && <Loading label="Loading Radar…" />}
      <ErrorText message={error} />
      {!loading && !error && offers.length === 0 && <Text style={styles.muted}>No available pickups in this area.</Text>}
      {canShowRadarMap && view === 'map' && <View style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <MapView style={{ height: 270 }} initialRegion={maltaRegion} userInterfaceStyle="dark" customMapStyle={mapStyle}
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
          <Text weight="medium" style={styles.muted}>Collector’s estimated net value</Text>
          <Text weight="heavy" style={{ color: colors.green, fontSize: 16 }}>€{offer.collector_profit.toFixed(2)}</Text>
        </View>
      </View>
      <View style={[styles.between, styles.rule]}>
        <Text style={styles.muted}>Pay Giver: <Text weight="bold">€{offer.seller_payout.toFixed(2)}</Text></Text>
        {!offer.availability?.length && <Button label="Reserve pickup →" kind="secondary" onPress={() => onReserve(offer)} disabled={busy || loading} />}
      </View>
      <Text style={styles.small}>{bagPolicyLabel(offer.bag_policy)}</Text>
      {offer.availability?.length ? <>
        <PickupAvailability offer={offer} />
        <RequestPickupTime offer={offer} onSaved={onRefresh} />
      </> : null}
    </Card>)}
  </ScrollView>;
}

export function HandoverScreen({ userId, taker, revision, offers, loading, error, busy, selectedId, onSelect, onSignIn, onRefresh, onChange }: {
  userId?: string; taker: boolean; revision: number; offers: PickupOffer[]; loading: boolean; error: string; busy: boolean; selectedId?: string;
  onSelect: (id?: string) => void; onSignIn: () => void; onRefresh: () => void; onChange: (offer: PickupOffer, status: NextStatus, code?: string) => void;
}) {
  const [linkError, setLinkError] = useState('');
  const [handoverCode, setHandoverCode] = useState<{ id: string; value: string }>();
  const [typedCode, setTypedCode] = useState<{ id: string; value: string }>();
  const participantKey = taker ? 'collector_id' : 'seller_id';
  const roleOffers = offers.filter((offer) => offer[participantKey] === userId);
  const selected = roleOffers.find((offer) => offer.id === selectedId);
  const active = selected?.status === 'reserved' || selected?.status === 'en_route' || selected?.status === 'arrived';
  const collector = !!selected && selected.collector_id === userId;

  function confirm(offer: PickupOffer, status: 'completed' | 'cancelled') {
    const label = status === 'completed' ? 'Record handover' : 'Cancel pickup';
    Alert.alert(label, status === 'completed' ? 'Confirm that the handover is complete.' : 'This will close the pickup.', [
      { text: 'Go back', style: 'cancel' },
      { text: label, style: status === 'cancelled' ? 'destructive' : 'default', onPress: () => onChange(offer, status) },
    ]);
  }

  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={userId
    ? <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={colors.sky} /> : undefined}>
    <Card style={{ borderRadius: 24 }}>
      <Text accessibilityRole="header" weight="heavy" style={styles.body}>{userId ? (taker ? 'Your pickups as Taker' : 'Your pickups as Giver') : 'Your pickups'}</Text>
      {!userId ? <Button label="Sign in to view pickups" onPress={onSignIn} style={{ alignSelf: 'flex-start' }} /> : <>
        {selectedId ? <Button label="← All pickups" kind="secondary" onPress={() => {
          setLinkError(''); setHandoverCode(undefined); setTypedCode(undefined); onSelect();
        }} /> : null}
        {loading && <Loading label="Loading your pickups…" />}
        <ErrorText message={error} />
        {!selectedId && roleOffers.map((offer) => <Pressable accessibilityRole="button" key={offer.id} style={styles.inset}
          onPress={() => { setLinkError(''); onSelect(offer.id); }}>
          <Text weight="bold" style={styles.body}>{offer.locality} · {offer.estimated_bottles} items</Text>
          <Text style={[styles.small, { color: pickupStatusColor[offer.status] }]}>{statusNames[offer.status]}</Text>
        </Pressable>)}
        <PickupArrangements key={selectedId ?? 'list'} userId={userId} participantKey={participantKey} listingId={selectedId} revision={revision}
          onSaved={onRefresh} onOpen={selectedId ? undefined : onSelect} />
        {selected && <>
          <Text weight="semibold" style={styles.body}>{selected.seller_name} · {selected.locality}</Text>
          <Text style={[styles.small, { color: pickupStatusColor[selected.status] }]}>Status · {statusNames[selected.status]}</Text>
          <PickupAvailability offer={selected} />
          <Text style={styles.small}>{bagPolicyLabel(selected.bag_policy)}</Text>
          {selected.status === 'open' && selected.seller_id === userId && <EditPickupAvailability key={selected.id + ':' + (selected.availability_version ?? 0)} offer={selected} onSaved={onRefresh} />}
          {!!selected.address_notes && <Text style={styles.small}>{selected.address_notes}</Text>}
          {active && selected.seller_phone && <Text style={styles.small}>Seller phone · {selected.seller_phone}</Text>}
          <Text style={styles.small}>{selected.seller_payout === 0 ? 'Free pickup' :
            'Pay the seller €' + selected.seller_payout.toFixed(2) + (selected.payout_method === 'revolut' ? ' via Revolut.' :
              selected.payout_method === 'cash' ? ' in cash.' : ' as agreed.')}</Text>
          {collector && active && selected.seller_payout > 0 && selected.payout_method === 'revolut'
            && selected.seller_revolut_tag && REVOLUT_TAG.test(selected.seller_revolut_tag) && <Button label="Open Revolut"
              kind="secondary" onPress={() => {
                const tag = encodeURIComponent(selected.seller_revolut_tag!.replace(/^@/, ''));
                Linking.openURL('https://revolut.me/' + tag + '?amount=' + selected.seller_payout.toFixed(2))
                  .catch(() => setLinkError('Could not open Revolut.'));
              }} style={{ alignSelf: 'flex-start' }} />}
          <ErrorText message={linkError} />
          {active && (collector ? <>
            <Field label="Six-digit code shown by the Giver" keyboardType="number-pad" maxLength={6}
              value={typedCode?.id === selected.id ? typedCode.value : ''}
              onChangeText={(value) => setTypedCode({ id: selected.id, value: value.replace(/\D/g, '').slice(0, 6) })} />
            <Button label="Complete handover" disabled={busy || typedCode?.id !== selected.id || typedCode.value.length !== 6}
              onPress={() => onChange(selected, 'completed', typedCode?.value)} />
          </> : <>
            <Button label="Show handover code" onPress={() => {
              setLinkError('');
              getHandoverCode(selected.id).then(({ code }) => setHandoverCode({ id: selected.id, value: code }))
                .catch((cause) => setLinkError(cause instanceof Error ? cause.message : 'Could not show the code.'));
            }} />
            {handoverCode?.id === selected.id && <Text weight="heavy" style={styles.title}>Show the Taker: {handoverCode.value}</Text>}
          </>)}
          <View style={styles.row}>
            {collector && selected.status === 'reserved' && <Button label="Mark on the way" kind="secondary" disabled={busy}
              onPress={() => onChange(selected, 'en_route')} />}
            {collector && selected.status === 'en_route' && <Button label="Mark arrived" kind="secondary" disabled={busy}
              onPress={() => onChange(selected, 'arrived')} />}
            {(active || selected.status === 'open') && <Button label="Cancel pickup" kind="quiet" disabled={busy}
              onPress={() => confirm(selected, 'cancelled')} />}
          </View>
          <Text style={styles.muted}>Users arrange and verify payment directly.</Text>
        </>}
      </>}
    </Card>
  </ScrollView>;
}

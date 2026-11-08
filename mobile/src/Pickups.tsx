import { useEffect, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Alert, Linking, Platform, RefreshControl, ScrollView, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { REVOLUT_TAG } from '../../lib/pickup-validation';
import { MALTA_LOCALITIES, type PickupOffer, type PickupStatus } from '../../lib/types';
import { EditPickupAvailability, PickupArrangements, PickupAvailability, RequestPickupTime } from './PickupSchedule';
import { errorMessage, listPickups } from './backend';
import { Badge, Button, Card, colors, ErrorText, localityOptions, Loading, Segmented, Select, styles, Text } from './ui';

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
      {offer.availability?.length ? <>
        <PickupAvailability offer={offer} />
        <RequestPickupTime offer={offer} onSaved={onRefresh} />
      </> : null}
    </Card>)}
  </ScrollView>;
}

export function HandoverScreen({ userId, revision, offers, loading, error, busy, selectedId, onSelect, onSignIn, onRefresh, onChange }: {
  userId?: string; revision: number; offers: PickupOffer[]; loading: boolean; error: string; busy: boolean; selectedId?: string;
  onSelect: (id: string) => void; onSignIn: () => void; onRefresh: () => void; onChange: (offer: PickupOffer, status: NextStatus) => void;
}) {
  const [linkError, setLinkError] = useState('');
  const selected = offers.find((offer) => offer.id === selectedId) ?? offers[0];
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
      <Text accessibilityRole="header" weight="heavy" style={styles.body}>Your pickups</Text>
      {!userId ? <Button label="Sign in to view pickups" onPress={onSignIn} style={{ alignSelf: 'flex-start' }} /> : <>
        <PickupArrangements userId={userId} revision={revision} onSaved={onRefresh} />
        {loading && <Loading label="Loading your pickups…" />}
        {!loading && !error && !offers.length && <Text style={styles.body}>You have no pickups yet.</Text>}
        <ErrorText message={error} />
        <Button label="Refresh pickups" kind="secondary" onPress={onRefresh} disabled={busy || loading} style={{ alignSelf: 'flex-start' }} />
        {selected && <>
          <Text style={styles.small}>Select pickup</Text>
          <Select label="Select pickup" value={selected.id} onChange={(id) => { setLinkError(''); onSelect(id); }} disabled={busy}
            options={offers.map((offer) => ({
              value: offer.id, label: offer.locality + ' · ' + offer.estimated_bottles + ' items · ' + statusNames[offer.status],
            }))} />
          <Text weight="semibold" style={styles.body}>{selected.seller_name} · {selected.locality}</Text>
          <Text style={styles.small}>Status · {statusNames[selected.status]}</Text>
          <PickupAvailability offer={selected} />
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
          <View style={styles.row}>
            {collector && selected.status === 'reserved' && <Button label="Mark on the way" kind="secondary" disabled={busy}
              onPress={() => onChange(selected, 'en_route')} />}
            {collector && selected.status === 'en_route' && <Button label="Mark arrived" kind="secondary" disabled={busy}
              onPress={() => onChange(selected, 'arrived')} />}
            {collector && active && <Button label="Record handover" disabled={busy} onPress={() => confirm(selected, 'completed')} />}
            {(active || selected.status === 'open') && <Button label="Cancel pickup" kind="quiet" disabled={busy}
              onPress={() => confirm(selected, 'cancelled')} />}
          </View>
          <Text style={styles.muted}>Users arrange and verify payment directly.</Text>
        </>}
      </>}
    </Card>
  </ScrollView>;
}

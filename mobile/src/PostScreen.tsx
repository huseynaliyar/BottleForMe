import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { ArrowRight, MapPin } from 'lucide-react-native';
import { Keyboard, Linking, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';
import { MAX_BAGS, MAX_CONTAINERS, MAX_SELLER_SPLIT, REVOLUT_TAG, validatePickup } from '../../lib/pickup-validation';
import { calculateDepositSplit, MALTA_LOCALITIES, type PickupOffer, type UserProfile } from '../../lib/types';
import { apiOrigin, errorMessage, publishPickup } from './backend';
import { nearbyStreets } from '../../lib/nearby-streets';
import { pickupAddressText, type AddressSuggestion } from '../../lib/pickup-address';
import { newWindow, parseWindowDrafts } from '../../lib/pickup-schedule';
import { AvailabilityEditor } from './PickupSchedule';
import { PickupAddressField } from './PickupAddressField';
import { Badge, Button, Card, colors, ErrorText, Field, Metric, Select, styles, Text } from './ui';

const containerFields = [
  { key: 'plastic_bottles', label: 'Plastic', icon: '🧴' },
  { key: 'cans', label: 'Cans', icon: '🥫' },
  { key: 'glass_bottles', label: 'Glass', icon: '🍾' },
] as const;
const zeroCounts = { plastic_bottles: '0', cans: '0', glass_bottles: '0' };
const localities = MALTA_LOCALITIES.map(({ name, region }) => ({ value: name, label: name + ' (' + region + ')' }));
const whole = (value: string) => /^\d+$/.test(value) ? Number(value) : NaN;

function Counter({ label, icon, value, onChange, busy }: {
  label: string; icon: string; value: string; onChange: (value: string) => void; busy: boolean;
}) {
  const count = whole(value);
  function step(amount: number) {
    onChange(String(Math.max(0, Math.min(MAX_CONTAINERS, (Number.isFinite(count) ? count : 0) + amount))));
  }
  return <View style={[styles.inset, { flex: 1, alignItems: 'center', padding: 6 }]}>
    <Text style={{ fontSize: 16 }}>{icon}</Text>
    <Text weight="bold" style={{ fontSize: 10 }}>{label}</Text>
    <TextInput accessibilityLabel={label + ' container count'} value={value} onChangeText={onChange}
      maxLength={6} selectTextOnFocus keyboardType="number-pad" keyboardAppearance="dark" editable={!busy}
      style={{
        minHeight: 36, width: '100%', padding: 0, fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold',
        textAlign: 'center', borderBottomWidth: 1, borderColor: colors.border, color: colors.lightBlue,
      }} />
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {[-1, 1].map((amount) => {
        const disabled = busy || (amount < 0 ? !(count > 0) : count >= MAX_CONTAINERS);
        const text = amount < 0 ? '−1' : '+1';
        return <Pressable key={amount} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
          accessibilityLabel={(amount < 0 ? 'Remove' : 'Add') + ' one ' + label.toLowerCase() + ' container'}
          onPress={() => step(amount)} style={{
            minWidth: 32, minHeight: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
            backgroundColor: amount < 0 ? '#20293a' : colors.blue, opacity: disabled ? 0.45 : 1,
          }}><Text weight="bold" style={{ fontSize: 12 }}>{text}</Text></Pressable>;
      })}
    </View>
  </View>;
}

export function PostScreen({ profile, signedIn, authReady, onSignIn, onPublished }: {
  profile: UserProfile | null; signedIn: boolean; authReady: boolean; onSignIn: () => void; onPublished: (offer: PickupOffer) => void;
}) {
  const [counts, setCounts] = useState(zeroCounts);
  const [bags, setBags] = useState(0);
  const [availabilityDraft, setAvailabilityDraft] = useState(() => [newWindow()]);
  const [split, setSplit] = useState(50);
  const [locality, setLocality] = useState('');
  const [notes, setNotes] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [addressSelection, setAddressSelection] = useState<AddressSuggestion | null>(null);
  const [addressLookup, setAddressLookup] = useState(false);
  const [method, setMethod] = useState<'cash' | 'revolut'>('cash');
  const [tag, setTag] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const [serverError, setServerError] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);
  const publishing = useRef(false);
  const requestKeys = useRef(new Map<string, string>());
  const profileLocality = profile?.locality;
  const profileTag = profile?.revolut_tag;

  useEffect(() => {
    if (profileLocality) setLocality((value) => value || profileLocality);
    if (profileTag) setTag((value) => value || profileTag);
  }, [profileLocality, profileTag]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiOrigin + '/api/addresses', { signal: controller.signal }).then((response) => response.ok ? response.json() : null)
      .then((settings) => { if (!controller.signal.aborted) setAddressLookup(settings?.enabled === true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const containers = {
    plastic_bottles: whole(counts.plastic_bottles),
    cans: whole(counts.cans),
    glass_bottles: whole(counts.glass_bottles),
  };
  const totals = calculateDepositSplit(containers.plastic_bottles, containers.cans, containers.glass_bottles, split);
  const countsValid = Object.values(containers).every((count) => Number.isSafeInteger(count) && count <= MAX_CONTAINERS);
  const countsError = !countsValid || totals.totalContainers < 1 || totals.totalContainers > MAX_CONTAINERS
    ? 'Enter whole numbers for a total of 1–10,000 eligible containers.' : '';
  const localityError = locality ? '' : 'Choose a pickup locality.';
  const fullAddress = pickupAddressText(pickupAddress, notes);
  const addressError = !pickupAddress.trim() ? 'Enter your pickup address.'
    : addressLookup && !addressSelection ? 'Choose an address from the Google Maps suggestions.'
      : fullAddress.length > 300 ? 'Use at most 300 characters for the address and instructions.' : '';
  const needsTag = method === 'revolut' && totals.sellerPayout > 0;
  const tagError = needsTag && !REVOLUT_TAG.test(tag.trim()) ? 'Enter a valid Revolut tag.' : '';
  const availability = parseWindowDrafts(availabilityDraft);
  const errors = [countsError, localityError, addressError, tagError, bags < 1 ? 'Specify the number of bags.' : '',
    availability ? '' : 'Add future, non-overlapping pickup windows in Malta time.'].filter(Boolean);
  const money = (amount: number) => '€' + (countsValid ? amount.toFixed(2) : '—');

  const [streets, setStreets] = useState<string[]>([]);
  const [gpsStreet, setGpsStreet] = useState('');

  async function useGps() {
    setStreets([]);
    setGpsStreet('');
    setLocationError('');
    setLocationMessage('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Allow location access or choose a locality manually.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const distance = ({ lat, lng }: typeof MALTA_LOCALITIES[number]) =>
        Math.hypot(lat - coords.latitude, (lng - coords.longitude) * Math.cos(coords.latitude * Math.PI / 180));
      const nearest = MALTA_LOCALITIES.reduce((best, item) => distance(item) < distance(best) ? item : best);
      setLocality(nearest.name);
      const names = await nearbyStreets(apiOrigin, coords.latitude, coords.longitude);
      setStreets(names);
      setLocationMessage(names.length ? 'Choose a nearby street, then edit the address below.' : 'No nearby streets found. Enter your street manually.');
    } catch {
      setLocationError('Could not use your location. Choose your locality manually.');
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    if (publishing.current) return;
    Keyboard.dismiss();
    if (!signedIn) { onSignIn(); return; }
    setAttempted(true);
    setServerError('');
    const values = validatePickup({
      locality, address_notes: fullAddress, bag_count: bags, split_percentage: split,
      payout_method: method, seller_revolut_tag: tag, containers,
    });
    if (!values || addressError || !availability) {
      if (countsError) scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    publishing.current = true;
    setBusy(true);
    try {
      const request = { ...values, pickup_address: pickupAddress.trim(), address_proof: addressSelection?.proof, availability };
      const payload = JSON.stringify(request);
      const key = requestKeys.current.get(payload) ?? randomUUID();
      requestKeys.current.set(payload, key);
      const created = await publishPickup(request, key);
      requestKeys.current.clear();
      setAvailabilityDraft([newWindow()]);
      setCounts(zeroCounts);
      setBags(0);
      setNotes('');
      setPickupAddress('');
      setAddressSelection(null);
      setAttempted(false);
      onPublished(created);
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }

  return <ScrollView ref={scroll} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <Card>
      <View style={styles.between}>
        <View>
          <Text weight="bold" style={styles.eyebrow}>Zero Queues · Doorstep Pickup</Text>
          <Text accessibilityRole="header" weight="bold" style={styles.title}>Arrange an empties pickup.</Text>
        </View>
        <Badge tone="green" style={{ fontSize: 12 }}>€0.10 per eligible item</Badge>
      </View>
      <View style={[styles.rule, { gap: 8 }]}>
        <View style={styles.between}>
          <Text weight="bold" style={[styles.eyebrow, { color: colors.muted }]}>Containers to hand over</Text>
          <Text weight="semibold" style={{ fontSize: 10, color: colors.lightBlue }}>Type exact count or tap − / +</Text>
        </View>
        <Text style={styles.muted}>Count only empty containers accepted by Malta’s BCRS. Check for an eligible, readable barcode and keep the container intact.</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {containerFields.map(({ key, label, icon }) => <Counter key={key} label={label} icon={icon}
            value={counts[key]} busy={busy} onChange={(value) => setCounts((previous) => ({ ...previous, [key]: value }))} />)}
        </View>
        <Text style={styles.small}>Total: <Text weight="bold">{countsValid ? totals.totalContainers : '—'} eligible items</Text></Text>
        <ErrorText message={attempted || !countsValid ? countsError : ''} />
        <View style={styles.between}>
          <Text style={styles.muted}>Pickup bags · {bags || 'Choose a quantity'}</Text>
          <View style={styles.row}>
            <Button label="−1 Bag" kind="quiet" disabled={busy || bags <= 1} onPress={() => setBags((value) => Math.max(1, value - 1))} />
            <Button label="+1 Bag" kind="secondary" disabled={busy || bags >= MAX_BAGS} onPress={() => setBags((value) => Math.min(MAX_BAGS, value + 1))} />
          </View>
        </View>
      </View>
    </Card>
    <Card>
      <View style={styles.between}>
        <View style={{ flexShrink: 1 }}>
          <Text weight="bold" style={styles.small}>Deposit Split Ratio</Text>
          <Text style={styles.muted}>Estimated BCRS voucher value <Text weight="semibold">{money(totals.totalDepositValue)}</Text></Text>
        </View>
        <Badge tone={split === 0 ? 'green' : split === 50 ? 'blue' : 'neutral'}>
          {split === 0 ? '100% Free Gift' : split === 50 ? '50/50 Fair Split' : split + '% to You'}
        </Badge>
      </View>
      <Slider accessibilityLabel="Seller share of estimated voucher value" value={split} minimumValue={0}
        maximumValue={MAX_SELLER_SPLIT} step={5} disabled={busy} onValueChange={setSplit}
        minimumTrackTintColor={colors.blue} maximumTrackTintColor="#243652" thumbTintColor={colors.white}
        style={{ height: 36, marginHorizontal: -4 }} />
      <View style={styles.between}>
        <Text style={styles.muted}>0% (Free Gift)</Text>
        <Text style={[styles.muted, { color: colors.lightBlue }]}>50% (Recommended)</Text>
        <Text style={styles.muted}>70%</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Metric label="You Get (At Door)" value={money(totals.sellerPayout)} caption="Direct Revolut / Cash" />
        <Metric label="Collector’s estimated net value" value={money(totals.collectorProfit)} caption="Voucher value minus seller payment" green />
      </View>
    </Card>
    <Card>
      <View style={styles.between}>
        <Text weight="bold" style={styles.small}>Location & Contact Details</Text>
        <Text weight="semibold" style={[styles.muted, { color: colors.sky }]}>Malta</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Select label="Pickup locality" options={localities} value={locality} placeholder="Choose a locality"
          onChange={(value) => { setLocality(value); setLocationMessage(''); setLocationError(''); }} disabled={busy || locating} style={{ flex: 1 }} />
        <Button label={locating ? 'Locating…' : 'Use GPS'} kind="secondary" onPress={useGps} disabled={busy || locating}>
          <MapPin size={14} color={colors.sky} />
        </Button>
      </View>
      <ErrorText message={locationError} />
      {locationMessage ? <Text style={styles.muted}>{locationMessage}</Text> : null}
      {needsTag && <Field label="Revolut tag" showLabel={false} value={tag} onChangeText={setTag} maxLength={51}
        placeholder="@your_revolut_tag" autoCapitalize="none" autoCorrect={false} editable={!busy} error={attempted ? tagError : ''} />}
      {streets.length > 0 && <View style={{ gap: 4 }}>
        <Select label="Nearby street" value={gpsStreet} options={streets.map((name) => ({ label: name, value: name }))}
          disabled={busy} onChange={(name) => { setGpsStreet(name); setPickupAddress(name); setAddressSelection(null); }} />
        <Text accessibilityRole="link" style={styles.muted} onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => {})}>© OpenStreetMap contributors</Text>
      </View>}
      <PickupAddressField value={pickupAddress} selection={addressSelection} enabled={addressLookup} signedIn={signedIn} busy={busy}
        onChange={(value) => { setPickupAddress(value); setAddressSelection(null); }}
        onSelect={(value) => { setPickupAddress(value.address); setAddressSelection(value); }} />
      <Field label="Private pickup instructions" showLabel={false} value={notes} onChangeText={setNotes} maxLength={300}
        placeholder="Door, intercom, or other instructions (optional)" editable={!busy} />
      <Text style={styles.muted}>Pickup instructions are shared with the collector who reserves this listing.</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="⚡ Revolut P2P" kind={method === 'revolut' ? 'secondary' : 'quiet'}
          style={{ flex: 1 }} onPress={() => setMethod('revolut')} disabled={busy} />
        <Button label="💵 Cash At Door" kind={method === 'cash' ? 'green' : 'quiet'}
          style={{ flex: 1 }} onPress={() => setMethod('cash')} disabled={busy} />
      </View>
    </Card>
    {attempted && errors.length > 0 && <View style={[styles.inset, { backgroundColor: '#350f1a', borderColor: '#763147' }]}>
      {errors.map((message) => <ErrorText key={message} message={'• ' + message} />)}
    </View>}
    <ErrorText message={serverError} />
    <AvailabilityEditor drafts={availabilityDraft} onChange={setAvailabilityDraft} disabled={busy} />
    <Button label={busy ? 'Publishing…' : 'Publish Collection Request'} disabled={!authReady || busy || locating} onPress={submit}>
      <ArrowRight size={16} color={colors.white} />
    </Button>
  </ScrollView>;
}

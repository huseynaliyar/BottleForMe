import { useLanguage } from '../../lib/language-context';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { AddressSuggestion } from '../../lib/pickup-address';
import { errorMessage, searchPickupAddresses } from './backend';
import { Field, Text, useUi } from './ui';

export function PickupAddressField({ value, selection, enabled, signedIn, busy, onChange, onSelect }: {
  value: string; selection: AddressSuggestion | null; enabled: boolean; signedIn: boolean; busy: boolean;
  onChange: (value: string) => void; onSelect: (value: AddressSuggestion) => void;
}) {
  const { t } = useLanguage();
  const { colors, styles } = useUi();
  const [lookup, setLookup] = useState<{ query: string; suggestions: AddressSuggestion[]; message?: string }>();
  const query = value.trim();
  const shouldSearch = enabled && signedIn && !selection && query.length >= 3;

  useEffect(() => {
    if (!shouldSearch) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPickupAddresses(query, controller.signal).then(({ suggestions }) => {
        if (!controller.signal.aborted) setLookup({ query, suggestions });
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setLookup({ query, suggestions: [], message: errorMessage(error) });
      });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, shouldSearch]);

  const result = shouldSearch && lookup?.query === query ? lookup : null;
  return <View style={{ gap: 6 }}>
    <Field label={t("Pickup address")} value={value} onChangeText={(text) => { setLookup(undefined); onChange(text); }}
      maxLength={240} editable={!busy} placeholder="Start with the street and number" />
    {enabled && <Text style={styles.muted}>Street address searches are sent to Google Maps. Enter door or intercom details in the separate instructions field.</Text>}
    {selection && <Text style={[styles.small, { color: colors.green }]}>Address selected</Text>}
    {enabled && !signedIn && <Text style={styles.muted}>Sign in to confirm your address with Google Maps.</Text>}
    {result && (result.suggestions.length ? (
      <View style={[styles.inset, { gap: 0, paddingVertical: 0 }]}>
        {result.suggestions.map((item) => <Pressable key={item.proof} accessibilityRole="button"
          onPress={() => onSelect(item)} disabled={busy} style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.border }}>
          <Text style={styles.small}>{item.address}</Text>
        </Pressable>)}
        <Text style={{ color: colors.white, fontSize: 12, paddingVertical: 8 }}>Google Maps</Text>
      </View>
    ) : <Text style={styles.muted} accessibilityLiveRegion="polite">{result.message ?? 'No matching street address. Try adding the town or house number.'}</Text>)}
  </View>;
}

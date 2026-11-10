import { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { pickupPhoneHelp } from '../../lib/pickup-partner';
import { errorMessage, loadSettings, saveSettings } from './backend';
import { Button, Card, colors, ErrorText, styles, Text } from './ui';
import type { useMobilePush } from './useMobilePush';

export default function SettingsScreen({ push, onBack }: { push: ReturnType<typeof useMobilePush>; onBack: () => void }) {
  const [sharePhone, setSharePhone] = useState<boolean>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void loadSettings(controller.signal)
      .then((result) => { if (!controller.signal.aborted) setSharePhone(result.sharePhone); })
      .catch((cause) => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, []);

  async function change(value: boolean) {
    setSaving(true);
    setError('');
    try { setSharePhone((await saveSettings(value)).sharePhone); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  }

  return <ScrollView contentContainerStyle={styles.scroll}>
    <Button label="‹ Profile" kind="quiet" onPress={onBack} />
    <Text accessibilityRole="header" weight="bold" style={styles.title}>Settings</Text>
    <Card>
      <Text weight="bold" style={styles.body}>Pickup privacy</Text>
      <View style={styles.between}>
        <Text style={styles.small}>Share my phone number</Text>
        <Switch accessibilityLabel="Share my phone number" value={sharePhone ?? false} trackColor={{ true: colors.blue }}
          disabled={sharePhone === undefined || saving} onValueChange={(value) => void change(value)} />
      </View>
      <Text style={styles.small}>{pickupPhoneHelp}</Text>
      <ErrorText message={error} />
    </Card>
    <Card>
      <Text weight="bold" style={styles.body}>Notifications</Text>
      {push.supported ? <>
        <Button label={push.enabled ? 'Turn off lock screen alerts' : 'Enable lock screen alerts'} kind="secondary"
          disabled={push.busy} onPress={push.toggle} />
        <ErrorText message={push.error ?? ''} />
      </> : <Text style={styles.small}>Lock-screen alerts are unavailable on this device.</Text>}
    </Card>
  </ScrollView>;
}

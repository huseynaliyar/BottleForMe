import { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { languages, isLocale } from '../../lib/locale';
import { useLanguage } from '../../lib/language-context';
import { themes } from '../../lib/appearance';
import { useAppearance } from './appearance';
import type { AccountLifecycle } from '../../lib/account-lifecycle';
import AccountLifecycleSettings from './AccountLifecycleSettings';
import { useBlockedAccounts } from '../../lib/use-blocked-accounts';
import { pickupPhoneHelp } from '../../lib/pickup-partner';
import { errorMessage, loadBlockedAccounts, loadSettings, saveSettings, unblockAccount } from './backend';
import { Button, Card, ErrorText, Segmented, Select, Text, useUi } from './ui';
import type { useMobilePush } from './useMobilePush';

type Props = {
  push: ReturnType<typeof useMobilePush>; onBack: () => void; signedIn: boolean;
  lifecycle?: AccountLifecycle; lifecycleError: string; onUpdate: (value: AccountLifecycle) => void; onDeleted: () => void;
};

export default function SettingsScreen({ push, onBack, signedIn, lifecycle, lifecycleError, onUpdate, onDeleted }: Props) {
  const { styles } = useUi();
  const { theme, setTheme } = useAppearance();
  const { locale, setLocale, t } = useLanguage();
  return <ScrollView contentContainerStyle={styles.scroll}>
    <Button label={t("‹ Profile")} kind="quiet" onPress={onBack} />
    <Text accessibilityRole="header" weight="bold" style={styles.pageTitle}>{t('Settings')}</Text>
    <Card>
      <Text weight="bold" style={styles.body}>{t("Appearance")}</Text>
      <Segmented options={themes} value={theme} onChange={setTheme} />
      <Text style={styles.small}>{t("Saved on this device.")}</Text>
    </Card>
    <Card><Select label={t('Language')} value={locale} options={languages}
      onChange={(value) => { if (isLocale(value)) setLocale(value); }} /></Card>
    {lifecycle ? <>
      {!lifecycle.paused && <ActiveSettings push={push} />}
      <AccountLifecycleSettings lifecycle={lifecycle} onUpdate={onUpdate} onDeleted={onDeleted} />
    </> : <Text style={styles.small}>{signedIn ? lifecycleError || t("Loading account status…") : t("Sign in to manage your account preferences.")}</Text>}
  </ScrollView>;
}

function ActiveSettings({ push }: Pick<Props, 'push'>) {
  const { t } = useLanguage();
  const { colors, styles } = useUi();
  const blocks = useBlockedAccounts(loadBlockedAccounts, unblockAccount);
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

  return <>
    <Card>
      <Text weight="bold" style={styles.body}>{t("Pickup privacy")}</Text>
      <View style={styles.between}>
        <Text style={styles.small}>{t("Share my phone number")}</Text>
        <Switch accessibilityLabel={t("Share my phone number")} value={sharePhone ?? false} trackColor={{ true: colors.blue }}
          disabled={sharePhone === undefined || saving} onValueChange={(value) => void change(value)} />
      </View>
      <Text style={styles.small}>{t(pickupPhoneHelp)}</Text>
      <ErrorText message={error} />
    </Card>
    <Card>
      <Text weight="bold" style={styles.body}>{t("Notifications")}</Text>
      {push.supported ? <>
        <Button label={push.enabled ? t("Turn off lock screen alerts") : t("Enable lock screen alerts")} kind="secondary"
          disabled={push.busy} onPress={push.toggle} />
        <ErrorText message={push.error ?? ''} />
      </> : <Text style={styles.small}>Lock-screen alerts are unavailable on this device.</Text>}
    </Card>
    <Card>
      <Text weight="bold" style={styles.body}>{t("Blocked accounts")}</Text>
      {blocks.accounts?.length === 0 && <Text style={styles.small}>{t("You haven’t blocked any accounts.")}</Text>}
      {!blocks.accounts && !blocks.error && <Text style={styles.small}>{t("Loading blocked accounts…")}</Text>}
      {blocks.accounts?.map((account) => <View key={account.id} style={styles.between}>
        <Text style={[styles.small, { flexShrink: 1 }]}>{account.name}</Text>
        <Button label={t("Unblock")} kind="quiet" disabled={blocks.busy} onPress={() => void blocks.remove(account.id)} />
      </View>)}
      <ErrorText message={blocks.error} />
    </Card>
  </>;
}

import { useLanguage } from '../../lib/language-context';
import { useState } from 'react';
import { Alert } from 'react-native';
import { accountDeleteInfo, accountPauseInfo, type AccountLifecycle } from '../../lib/account-lifecycle';
import { changeAccountLifecycle, errorMessage } from './backend';
import { Button, Card, ErrorText, Field, Text, useUi } from './ui';

export default function AccountLifecycleSettings({ lifecycle, onUpdate, onDeleted }: {
  lifecycle: AccountLifecycle; onUpdate: (value: AccountLifecycle) => void; onDeleted: () => void;
}) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState('');
  const { paused, deleting } = lifecycle;

  async function apply(action: 'pause' | 'reactivate' | 'delete') {
    if (busy || action === 'delete' && !password) return;
    setBusy(true);
    setError('');
    try {
      const result = await changeAccountLifecycle(action, action === 'delete' ? password : undefined);
      if (action === 'delete') onDeleted();
      else onUpdate(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      if (action === 'delete') setPassword('');
      setBusy(false);
    }
  }

  return <Card>
    <Text weight="bold" style={styles.body}>{t("Account access")}</Text>
    <Text style={styles.small}>{deleting ? t("Deletion is pending.") : paused ? t("Your account is deactivated.") : accountPauseInfo}</Text>
    {!deleting && <Button label={paused ? t("Reactivate account") : t("Deactivate account")} kind="secondary" disabled={busy}
      onPress={() => paused ? void apply('reactivate') : Alert.alert('Deactivate your BottleForMe account?', accountPauseInfo, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => void apply('pause') },
      ])} />}
    <Button label={deleting ? t("Retry account deletion") : t("Delete account")} kind="quiet" disabled={busy} onPress={() => setShowDelete(!showDelete)} />
    {showDelete && <>
      <Text style={styles.small}>{accountDeleteInfo}</Text>
      <Field label={t("Current password")} secureTextEntry autoComplete="current-password" value={password}
        onChangeText={setPassword} maxLength={256} editable={!busy} />
      <Button label={t("Delete permanently")} kind="secondary" disabled={busy || !password} onPress={() => Alert.alert(
        'Permanently delete your BottleForMe account?', accountDeleteInfo, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void apply('delete') },
        ],
      )} />
    </>}
    <ErrorText message={error} />
  </Card>;
}

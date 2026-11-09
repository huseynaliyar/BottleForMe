import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { AppState, Platform } from 'react-native';
import { errorMessage, setMobilePushDevice } from './backend';

const channel = 'bottleforme-messages';
const deviceKey = 'bottleforme.push.installation';
const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
const supported = !!projectId && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
  && (Platform.OS === 'ios' || Platform.OS === 'android');

const preferenceKey = (userId: string) => 'bottleforme.push.enabled.' + userId;
let installation: Promise<string> | undefined;

function installationId() {
  installation ??= (async () => {
    const existing = await AsyncStorage.getItem(deviceKey);
    if (existing) return existing;
    const id = randomUUID();
    await AsyncStorage.setItem(deviceKey, id);
    return id;
  })().catch((error) => {
    installation = undefined;
    throw error;
  });
  return installation;
}

async function notificationToken(prompt: boolean) {
  const api = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await api.setNotificationChannelAsync(channel, {
      name: 'BottleForMe messages',
      importance: api.AndroidImportance.HIGH,
      lockscreenVisibility: api.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });
  }

  let permission = await api.getPermissionsAsync();
  if (!permission.granted && prompt && permission.canAskAgain) {
    permission = await api.requestPermissionsAsync();
  }
  if (!permission.granted) return null;
  return (await api.getExpoPushTokenAsync({ projectId })).data;
}

export function useMobilePush(userId: string | undefined, openInbox: (pickupId?: string) => void) {
  const [state, setState] = useState<{ userId: string; enabled: boolean; error?: string }>();
  const [busy, setBusy] = useState(false);
  const operation = useRef<Promise<void> | null>(null);
  const enabled = state?.userId === userId && !!state?.enabled;

  useEffect(() => {
    if (!supported) return;
    let active = true;
    let subscription: { remove(): void } | undefined;
    void import('expo-notifications').then(async (api) => {
      if (!active) return;
      api.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
        }),
      });
      const openMessage = (response: Awaited<ReturnType<typeof api.getLastNotificationResponseAsync>>) => {
        if (!active || response?.notification.request.content.data?.type !== 'admin_message') return;
        const pickupId = response.notification.request.content.data.pickupId;
        openInbox(typeof pickupId === 'string' && /^[0-9a-f-]{36}$/i.test(pickupId) ? pickupId : undefined);
        void api.clearLastNotificationResponseAsync().catch(() => {});
      };
      subscription = api.addNotificationResponseReceivedListener(openMessage);
      openMessage(await api.getLastNotificationResponseAsync());
    }).catch(() => {});
    return () => { active = false; subscription?.remove(); };
  }, [openInbox]);

  useEffect(() => {
    if (!supported || !userId) return;
    const account = userId;
    let active = true;

    async function sync() {
      if (operation.current) return;
      const task = (async () => {
        const preferred = await AsyncStorage.getItem(preferenceKey(account));
        if (!active) return;
        if (preferred === 'no') {
          setState({ userId: account, enabled: false });
          return;
        }
        const token = await notificationToken(preferred === null);
        if (active && preferred === null) await AsyncStorage.setItem(preferenceKey(account), 'yes');
        if (!active) return;
        await setMobilePushDevice(account, await installationId(), token);
        if (active) setState({ userId: account, enabled: !!token });
      })();
      operation.current = task;
      try {
        await task;
      } catch {
        if (active) setState({ userId: account, enabled: false, error: 'Could not sync push alerts. Try enabling them again.' });
      } finally {
        operation.current = null;
      }
    }

    const initial = setTimeout(() => void sync(), 0);
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void sync();
    });
    return () => { active = false; clearTimeout(initial); foreground.remove(); };
  }, [userId]);

  async function toggle() {
    if (!supported || !userId || operation.current) return;
    const account = userId;
    setBusy(true);
    const task = (async () => {
      const token = enabled ? null : await notificationToken(true);
      if (!enabled && !token) throw new Error('Allow BottleForMe notifications in your phone settings.');
      await setMobilePushDevice(account, await installationId(), token);
      await AsyncStorage.setItem(preferenceKey(account), token ? 'yes' : 'no');
      setState({ userId: account, enabled: !!token });
    })();
    operation.current = task;
    try {
      await task;
    } catch (error) {
      setState({ userId: account, enabled, error: errorMessage(error) });
    } finally {
      operation.current = null;
      setBusy(false);
    }
  }

  async function unregister() {
    if (!supported || !userId) return;
    await operation.current?.catch(() => {});
    const id = await AsyncStorage.getItem(deviceKey);
    if (id) await setMobilePushDevice(userId, id, null);
  }

  return { supported, enabled, busy, toggle, unregister, error: state?.userId === userId ? state?.error : undefined };
}

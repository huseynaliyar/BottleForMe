'use client';

import { accountRequest } from './auth';

const ownerKey = 'bottleforme-web-push-owner';
const route = '/api/push/web';

export async function browserPushInfo(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return null;
  const [registration, config] = await Promise.all([
    navigator.serviceWorker.getRegistration(),
    accountRequest(route, {}, false) as Promise<{ publicKey: string | null }>,
  ]);
  if (!registration?.active || !config.publicKey) return null;
  const subscription = await registration.pushManager.getSubscription();
  let enabled = false;
  try { enabled = !!subscription && localStorage.getItem(ownerKey) === userId; } catch { /* Storage may be disabled. */ }
  return { registration, publicKey: config.publicKey, subscription, enabled };
}

export async function enableBrowserPush(info: NonNullable<Awaited<ReturnType<typeof browserPushInfo>>>, userId: string) {
  const subscription = info.subscription ?? await info.registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: info.publicKey,
  });
  await accountRequest(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  });
  try { localStorage.setItem(ownerKey, userId); } catch { /* Storage may be disabled. */ }
  return subscription;
}

export async function disableBrowserPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const results = await Promise.allSettled([
      accountRequest(route, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
        signal: AbortSignal.timeout(4_000),
      }),
      subscription.unsubscribe(),
    ]);
    if (results.every((result) => result.status === 'rejected')) throw new Error('Could not turn off lock-screen alerts.');
  }
  try { localStorage.removeItem(ownerKey); } catch { /* Storage may be disabled. */ }
}

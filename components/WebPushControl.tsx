'use client';

import { useEffect, useRef, useState } from 'react';
import { browserPushInfo, disableBrowserPush, enableBrowserPush } from '@/lib/browser-push';

type PushInfo = Awaited<ReturnType<typeof browserPushInfo>>;

export default function WebPushControl({ userId }: { userId: string }) {
  const [info, setInfo] = useState<PushInfo>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    browserPushInfo(userId)
      .then((result) => { if (active) setInfo(result); })
      .catch(() => { if (active) setInfo(null); });
    return () => { active = false; };
  }, [userId]);

  async function toggle() {
    if (!info || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (info.enabled) {
        await disableBrowserPush();
        setInfo(await browserPushInfo(userId));
      } else {
        const subscription = await enableBrowserPush(info, userId);
        setInfo({ ...info, subscription, enabled: true });
      }
    } catch (cause) {
      setError(Notification.permission === 'denied'
        ? 'Allow notifications for BottleForMe in your device or browser settings.'
        : cause instanceof Error ? cause.message : 'Could not update lock-screen alerts.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (info === undefined) return null;
  return <div className="mb-3 rounded-xl border border-white/10 p-3 text-xs text-blue-200">
    {info ? <>
      <button type="button" disabled={busy} className="font-semibold text-blue-300 disabled:opacity-60" onClick={() => void toggle()}>
        {info.enabled ? 'Disable lock-screen alerts' : 'Enable lock-screen alerts'}
      </button>
      <p className="mt-1" aria-live="polite">{info.enabled ? 'Lock-screen alerts are on for this browser.' : 'Get an alert when there’s new activity in your inbox.'}</p>
    </> : <p>Lock-screen alerts are unavailable here. On iPhone or iPad, add BottleForMe to your Home Screen and open it from there.</p>}
    {error && <p role="alert" className="mt-1 text-red-300">{error}</p>}
  </div>;
}

import { useEffect, useState } from 'react';
import type { AccountLifecycle } from './account-lifecycle';

export function useAccountLifecycle(userId: string | undefined, load: (signal: AbortSignal) => Promise<AccountLifecycle>) {
  const [status, setStatus] = useState<{ userId: string; value: AccountLifecycle }>();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    void load(controller.signal).then((value) => {
      if (!controller.signal.aborted) { setStatus({ userId, value }); setError(''); }
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load your account status.');
    });
    return () => controller.abort();
  }, [userId, load]);

  return {
    lifecycle: status && status.userId === userId ? status.value : undefined,
    error,
    update(value: AccountLifecycle) { if (userId) setStatus({ userId, value }); },
  };
}

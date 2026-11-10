import { useEffect, useState } from 'react';
import type { BlockedAccount } from './marketplace-blocks';

export function useBlockedAccounts(load: (signal: AbortSignal) => Promise<{ accounts: BlockedAccount[] }>,
  unblock: (id: string) => Promise<unknown>) {
  const [accounts, setAccounts] = useState<BlockedAccount[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then((result) => {
      if (!controller.signal.aborted) setAccounts(result.accounts);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load blocked accounts.');
    });
    return () => controller.abort();
  }, [load]);

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await unblock(id);
      setAccounts((items) => items?.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unblock this account.');
    } finally { setBusy(false); }
  }
  return { accounts, remove, busy, error };
}

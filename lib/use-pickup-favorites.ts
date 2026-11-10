import { useEffect, useState } from 'react';

export function usePickupFavorites(userId: string | undefined, load: (signal: AbortSignal) => Promise<{ ids: string[] }>,
  save: (id: string, saved: boolean) => Promise<unknown>) {
  const [result, setResult] = useState<{ userId: string; ids: string[] }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ids = result?.userId === userId ? result?.ids : undefined;

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    load(controller.signal).then((value) => {
      if (!controller.signal.aborted) { setResult({ userId, ids: value.ids }); setError(''); }
    }).catch(() => {
      if (!controller.signal.aborted) setError('Could not load favorites.');
    });
    return () => controller.abort();
  }, [userId, load]);

  async function toggle(id: string) {
    if (!userId || !ids || busy) return;
    const saved = !ids.includes(id);
    setBusy(true);
    setError('');
    try {
      await save(id, saved);
      setResult((current) => current?.userId === userId
        ? { userId, ids: saved ? [...new Set([...current.ids, id])] : current.ids.filter((item) => item !== id) }
        : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update favorites.');
    } finally {
      setBusy(false);
    }
  }

  return { ids, error, busy, toggle };
}

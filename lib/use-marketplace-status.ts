import { useEffect, useState } from 'react';

export function useMarketplaceStatus(origin = '') {
  const [maintenance, setMaintenance] = useState(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      try {
        const res = await fetch(origin + '/api/status', { signal: current.signal });
        if (!res.ok) return;
        const status = await res.json();
        if (active && !current.signal.aborted && typeof status.maintenance === 'boolean') setMaintenance(status.maintenance);
      } catch { /* Retain the last known state while offline. */ }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => { active = false; controller?.abort(); clearInterval(timer); };
  }, [origin]);
  return maintenance;
}

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { pickupRequest } from '@/lib/auth';
import { useLanguage } from '@/lib/language-context';
import { pickupInitials } from '@/lib/pickup-conversation';
import type { PickupPartner } from '@/lib/pickup-partner';

export function PickupPartnerProfile({ pickupId, name, children }: {
  pickupId: string; name: string; children: ReactNode;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="bf-partner-trigger shrink-0 rounded-full" aria-haspopup="dialog"
      aria-label={t('View pickup partner profile') + ' · ' + name} onClick={() => setOpen(true)}>
      {children}
    </button>
    {open && <PartnerDialog pickupId={pickupId} onClose={() => setOpen(false)} />}
  </>;
}

function PartnerDialog({ pickupId, onClose }: { pickupId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<{ partner?: PickupPartner; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    void pickupRequest('/' + encodeURIComponent(pickupId) + '/partner', { signal: controller.signal })
      .then((partner: PickupPartner) => { if (!controller.signal.aborted) setResult({ partner }); })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setResult({ error: cause instanceof Error ? cause.message : 'Could not load your pickup partner.' });
      });
    return () => controller.abort();
  }, [pickupId]);
  const partner = result?.partner;
  return <dialog ref={(node) => { if (node && !node.open) node.showModal(); }} onClose={onClose}
    aria-label={t('Pickup partner')} className="bf-partner-dialog m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-sm space-y-4 overflow-y-auto rounded-[18px] border border-blue-400/25 bg-[#0e1626] p-5 text-white backdrop:bg-black/60">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{t('Pickup partner')}</h2>
      <form method="dialog"><button autoFocus className="min-h-11 rounded-xl border border-blue-400/25 px-3 text-sm">{t('Close')}</button></form>
    </div>
    {partner ? <>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="bf-avatar grid size-11 shrink-0 place-items-center rounded-full bg-blue-950 font-semibold">{pickupInitials(partner.name)}</span>
        <div>
          <h3 className="text-lg font-bold [overflow-wrap:anywhere]">{partner.name}</h3>
          <p className="text-sm text-blue-200">{t(partner.role)}</p>
        </div>
      </div>
      <dl className="bf-fact-rows">
        <div><dt>{t('Rating')}</dt><dd>{partner.count && partner.average !== null ? partner.average + '/5 · ' + partner.count : t('No ratings yet')}</dd></div>
        <div><dt>{t('Phone')}</dt><dd>{partner.phone && !partner.blockedByYou ? <a href={'tel:' + partner.phone.replace(/[^\d+]/g, '')} className="text-blue-300 underline" dir="ltr">{partner.phone}</a> : t('Unavailable')}</dd></div>
      </dl>
    </> : result?.error ? <p role="alert" className="text-red-300">{result.error}</p> : <p role="status" className="text-blue-200">{t('Loading pickup partner…')}</p>}
  </dialog>;
}

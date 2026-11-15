'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useLanguage } from '@/lib/language-context';
import PickupPartner from '@/components/PickupPartner';

export function PickupPartnerProfile({ pickupId, name, children, className = 'shrink-0 rounded-full', heading: Heading }: {
  pickupId: string; name: string; children: ReactNode; className?: string; heading?: 'h1' | 'h3';
}) {
  const { t } = useLanguage();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const button = <button ref={trigger} type="button" className={'bf-partner-trigger ' + className} aria-haspopup="dialog"
    aria-label={t('View pickup partner profile') + ' · ' + name} onClick={() => setOpen(true)}>
    {children}
  </button>;
  return <>
    {Heading ? <Heading>{button}</Heading> : button}
    {open && <dialog ref={(node) => { if (node && !node.open) node.showModal(); }}
      onClose={() => { setOpen(false); trigger.current?.focus(); }}
      aria-label={t('Pickup partner')} className="bf-partner-dialog m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-sm space-y-4 overflow-y-auto rounded-[18px] border border-blue-400/25 bg-[#0e1626] p-5 text-white backdrop:bg-black/60">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('Pickup partner')}</h2>
        <form method="dialog"><button autoFocus className="min-h-11 rounded-xl border border-blue-400/25 px-3 text-sm">{t('Close')}</button></form>
      </div>
      <PickupPartner pickupId={pickupId} />
    </dialog>}
  </>;
}

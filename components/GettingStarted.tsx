'use client';

import { useLanguage } from '@/lib/language-context';
import { useEffect, useRef, useState } from 'react';
import { gettingStarted } from '@/lib/getting-started';

export default function GettingStarted({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const item = gettingStarted[step];
  const last = step === gettingStarted.length - 1;

  return <dialog ref={dialog} aria-labelledby="getting-started-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-sm space-y-3 rounded-2xl bg-[#0e1626] p-5 text-white backdrop:bg-black/70">
    <p className="text-sm text-blue-200">Getting started · {step + 1} of {gettingStarted.length}</p>
    <h2 id="getting-started-title" className="text-lg font-bold">{t(item.title)}</h2>
    <p aria-live="polite">{t(item.description)}</p>
    <div className="flex flex-wrap gap-3">
      {step > 0 && <button type="button" className="rounded-lg bg-white/10 px-3 py-2" onClick={() => setStep(step - 1)}>{t("Back")}</button>}
      <button type="button" className="blue-btn rounded-lg px-3 py-2 font-bold" onClick={() => last ? onClose() : setStep(step + 1)}>{last ? t("Done") : t("Next")}</button>
      {!last && <button type="button" className="px-3 py-2 text-blue-200" onClick={onClose}>{t("Skip")}</button>}
    </div>
  </dialog>;
}

'use client';

import { useLanguage } from '@/lib/language-context';
import Link from 'next/link';
import { supportFaq } from '@/lib/support-faq';

export default function HelpPage() {
  const { t } = useLanguage();
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-white">
    <Link href="/" className="text-blue-300">{t("← BottleForMe")}</Link>
    <h1 className="text-2xl font-bold">{t("Help & FAQ")}</h1>
    {supportFaq.map(({ question, answer }) => <details key={question} className="glass-navy rounded-xl p-4">
      <summary className="cursor-pointer font-semibold">{t(question)}</summary>
      <p className="mt-2 text-blue-200">{t(answer)}</p>
    </details>)}
  </main>;
}

import Link from 'next/link';
import { supportFaq } from '@/lib/support-faq';

export default function HelpPage() {
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-white">
    <Link href="/" className="text-blue-300">← BottleForMe</Link>
    <h1 className="text-2xl font-bold">Help &amp; FAQ</h1>
    {supportFaq.map(({ question, answer }) => <details key={question} className="glass-navy rounded-xl p-4">
      <summary className="cursor-pointer font-semibold">{question}</summary>
      <p className="mt-2 text-blue-200">{answer}</p>
    </details>)}
  </main>;
}

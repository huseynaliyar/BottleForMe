import Link from 'next/link';
import { draftTerms } from '@/lib/draft-terms';

export default function TermsPage() {
  return <main className="mx-auto max-w-lg space-y-4 px-4 py-8 text-white">
    <Link href="/" className="text-blue-300">← BottleForMe</Link>
    <h1 className="text-2xl font-bold">Draft Terms &amp; Conditions</h1>
    <p className="text-blue-200">These are provisional rules. BottleForMe will publish its final terms separately.</p>
    <ul className="list-disc space-y-3 pl-5">{draftTerms.map((term) => <li key={term}>{term}</li>)}</ul>
  </main>;
}

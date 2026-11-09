import type { Metadata } from 'next';

export const metadata: Metadata = { referrer: 'no-referrer', robots: { index: false } };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

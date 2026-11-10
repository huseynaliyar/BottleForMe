'use client';

import { useLanguage } from '@/lib/language-context';
import { Trophy } from 'lucide-react';
import { useImpactAchievement } from '@/lib/use-impact-achievement';

const load = async (key: string) => localStorage.getItem(key);
const persist = async (key: string, value: string) => localStorage.setItem(key, value);

export default function ImpactAchievement({ userId, containers, completed }: { userId: string; containers: number; completed: number }) {
  const { t } = useLanguage();
  const { achievement, dismiss } = useImpactAchievement(userId, containers, completed, load, persist);
  if (!achievement) return null;
  return <div className="impact-achievement flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
    <Trophy className="size-4" aria-hidden="true" />
    <p role="status">Achievement unlocked · {achievement.title}</p>
    <button type="button" onClick={dismiss} className="ml-auto min-h-9 rounded-lg px-2 font-semibold">{t("Dismiss")}</button>
  </div>;
}

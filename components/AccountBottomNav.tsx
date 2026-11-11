'use client';

import { Compass, MessageSquare, Package, User } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useLanguage } from '@/lib/language-context';

const accountPages = new Set(['/settings', '/balance', '/help', '/terms']);

export default function AccountBottomNav() {
  const visible = accountPages.has(usePathname());
  const [role, setRole] = useState<string | null>(null);
  const { t } = useLanguage();
  useEffect(() => {
    if (!visible || !supabase) return;
    let active = true;
    const client = supabase;
    void client.auth.getSession().then(async ({ data }) => {
      if (!data.session) return 'giver';
      const { data: profile } = await client.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
      return profile?.role ?? 'giver';
    }).then((value) => { if (active) setRole(value); }).catch(() => {});
    return () => { active = false; };
  }, [visible]);
  if (!visible) return null;
  const tabs = [
    [role === 'taker' ? 'Radar' : 'Give', '/', role === 'taker' ? Compass : Package],
    ['Pickups', '/?view=pickups', MessageSquare],
    ['Profile', '/?view=profile', User],
  ] as const;
  return <>
    <div className="h-[calc(3.75rem+env(safe-area-inset-bottom))]" aria-hidden="true" />
    <nav aria-label={t('Main navigation')} className="bf-phone bf-nav fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg justify-around border-t border-blue-500/15 bg-[#090e1a] px-5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-blue-200/70">
      {tabs.filter(([, href]) => href !== '/' || !supabase || role !== null).map(([label, href, Icon]) => <Link key={label} href={href} aria-current={label === 'Profile' ? 'page' : undefined} className="flex flex-col items-center gap-1 text-[10px] font-semibold hover:text-white">
        <Icon className="size-4" aria-hidden="true" />{t(label)}
      </Link>)}
    </nav>
  </>;
}

begin;
create table public.pickup_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  pickup_id uuid not null references public.pickups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pickup_id)
);
alter table public.pickup_favorites enable row level security;
revoke all on public.pickup_favorites from public, anon, authenticated;
grant select, insert, update, delete on public.pickup_favorites to service_role;

create table public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  pickup_id uuid references public.pickups(id) on delete set null,
  target text not null check (target in ('listing', 'user')),
  reason text not null check (char_length(reason) between 10 and 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, pickup_id, target)
);
alter table public.marketplace_reports enable row level security;
revoke all on public.marketplace_reports from public, anon, authenticated;
grant select, insert, update on public.marketplace_reports to service_role;
create index marketplace_reports_queue on public.marketplace_reports (created_at, id) where reviewed_at is null;
commit;

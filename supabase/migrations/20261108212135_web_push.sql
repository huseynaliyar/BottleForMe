begin;

create table public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  updated_at timestamptz not null default now()
);
create index web_push_subscriptions_user on public.web_push_subscriptions (user_id);

create table public.web_push_jobs (
  batch_id uuid not null,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  user_id uuid not null,
  attempts integer not null default 0,
  status text not null default 'queued' check (status in ('queued', 'accepted', 'failed')),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  primary key (batch_id, subscription_id),
  foreign key (user_id, batch_id) references public.account_notifications(user_id, batch_id) on delete cascade
);
create index web_push_jobs_due on public.web_push_jobs (next_attempt_at) where status = 'queued';
create index web_push_jobs_subscription on public.web_push_jobs (subscription_id);

alter table public.web_push_subscriptions enable row level security;
alter table public.web_push_jobs enable row level security;
revoke all on public.web_push_subscriptions, public.web_push_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.web_push_subscriptions to service_role;
grant select, update, delete on public.web_push_jobs to service_role;

create function public.queue_web_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.web_push_jobs (batch_id, subscription_id, user_id)
    select new.batch_id, s.id, new.user_id
    from public.web_push_subscriptions as s
    where s.user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.queue_web_push() from public, anon, authenticated;
create trigger queue_web_push after insert on public.account_notifications
  for each row execute function public.queue_web_push();

create function public.register_web_push(owner_id uuid, push_endpoint text, public_key text, auth_key text)
returns boolean language plpgsql set search_path = ''
as $$
declare
  previous public.web_push_subscriptions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(push_endpoint, 7));
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 8));
  select * into previous from public.web_push_subscriptions as s where s.endpoint = push_endpoint for update;
  if (previous.user_id is distinct from owner_id) and
    (select count(*) from public.web_push_subscriptions where user_id = owner_id) >= 10 then
    return false;
  end if;

  -- A new owner or changed keys must never inherit jobs from the old subscription.
  if previous.id is not null and
      (previous.user_id, previous.p256dh, previous.auth) is distinct from (owner_id, public_key, auth_key) then
    delete from public.web_push_subscriptions where id = previous.id;
  end if;

  insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
    values (owner_id, push_endpoint, public_key, auth_key)
  on conflict (endpoint) do update set updated_at = now();
  return true;
end;
$$;
revoke all on function public.register_web_push(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.register_web_push(uuid,text,text,text) to service_role;

create function public.claim_web_push(target_batch uuid default null)
returns table (batch_id uuid, subscription_id uuid, endpoint text, p256dh text, auth text, attempts integer, lease_id uuid)
language sql set search_path = ''
as $$
  with due as (
    select j.batch_id, j.subscription_id
    from public.web_push_jobs as j
    where j.status = 'queued' and j.next_attempt_at <= now()
      and (target_batch is null or j.batch_id = target_batch)
    order by j.next_attempt_at
    limit 16
    for update skip locked
  ), claimed as (
    update public.web_push_jobs as j
    set next_attempt_at = now() + interval '5 minutes', attempts = j.attempts + 1,
        lease_id = gen_random_uuid()
    from due
    where (j.batch_id, j.subscription_id) = (due.batch_id, due.subscription_id)
    returning j.*
  )
  select c.batch_id, c.subscription_id, s.endpoint, s.p256dh, s.auth, c.attempts, c.lease_id
  from claimed as c join public.web_push_subscriptions as s on s.id = c.subscription_id and s.user_id = c.user_id;
$$;
revoke all on function public.claim_web_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_web_push(uuid) to service_role;

commit;

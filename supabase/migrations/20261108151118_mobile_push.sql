begin;

create table public.mobile_push_devices (
  installation_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  updated_at timestamptz not null default now()
);
create index mobile_push_devices_user on public.mobile_push_devices (user_id);

create table public.mobile_push_jobs (
  batch_id uuid not null,
  installation_id uuid not null references public.mobile_push_devices(installation_id) on delete cascade,
  user_id uuid not null,
  attempts integer not null default 0,
  ticket_id text,
  status text not null default 'queued' check (status in ('queued', 'accepted', 'failed')),
  next_attempt_at timestamptz not null default now(),
  lease_id uuid,
  created_at timestamptz not null default now(),
  primary key (batch_id, installation_id),
  foreign key (user_id, batch_id) references public.account_notifications(user_id, batch_id) on delete cascade
);
create index mobile_push_jobs_due on public.mobile_push_jobs (next_attempt_at) where status = 'queued';

alter table public.mobile_push_devices enable row level security;
alter table public.mobile_push_jobs enable row level security;
revoke all on public.mobile_push_devices, public.mobile_push_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.mobile_push_devices to service_role;
grant select, update, delete on public.mobile_push_jobs to service_role;

create function public.queue_mobile_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.mobile_push_jobs (batch_id, installation_id, user_id)
  select new.batch_id, d.installation_id, new.user_id
  from public.mobile_push_devices as d
  where d.user_id = new.user_id
    and d.updated_at > now() - interval '90 days'
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.queue_mobile_push() from public, anon, authenticated;

create trigger queue_mobile_push after insert on public.account_notifications
  for each row execute function public.queue_mobile_push();

create function public.claim_mobile_push(target_batch uuid default null)
returns table (
  batch_id uuid, installation_id uuid, user_id uuid, token text, attempts integer, ticket_id text, lease_id uuid
)
language sql security invoker set search_path = ''
as $$
  with due as (
    select j.batch_id, j.installation_id
    from public.mobile_push_jobs as j
    join public.mobile_push_devices as d using (installation_id)
    where j.status = 'queued' and j.next_attempt_at <= now()
      and d.user_id = j.user_id
      and (target_batch is null or j.batch_id = target_batch)
    order by j.next_attempt_at
    limit 100
    for update of j skip locked
  ), claimed as (
    update public.mobile_push_jobs as j
    set next_attempt_at = now() + interval '5 minutes',
        attempts = j.attempts + 1,
        lease_id = gen_random_uuid()
    from due
    where j.batch_id = due.batch_id and j.installation_id = due.installation_id
    returning j.*
  )
  select c.batch_id, c.installation_id, c.user_id, d.token, c.attempts, c.ticket_id, c.lease_id
  from claimed as c join public.mobile_push_devices as d using (installation_id)
  where c.user_id = d.user_id;
$$;
revoke all on function public.claim_mobile_push(uuid) from public, anon, authenticated;
grant execute on function public.claim_mobile_push(uuid) to service_role;

create function public.register_mobile_push(device_id uuid, owner_id uuid, expo_token text)
returns boolean language plpgsql security invoker set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(expo_token, 0));
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 1));

  if (select count(*) from public.mobile_push_devices
      where user_id = owner_id and installation_id <> device_id and token <> expo_token) >= 10 then
    return false;
  end if;

  delete from public.mobile_push_jobs where installation_id = device_id and user_id <> owner_id;
  delete from public.mobile_push_devices where token = expo_token and installation_id <> device_id;
  insert into public.mobile_push_devices (installation_id, user_id, token)
  values (device_id, owner_id, expo_token)
  on conflict (installation_id) do update
    set user_id = excluded.user_id, token = excluded.token, updated_at = now();
  return true;
end;
$$;
revoke all on function public.register_mobile_push(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.register_mobile_push(uuid, uuid, text) to service_role;

commit;

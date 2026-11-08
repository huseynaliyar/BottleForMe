begin;

create table public.admin_notification_batches (
  id uuid primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  message text not null check (char_length(btrim(message)) between 1 and 500),
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.account_notifications (
  batch_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (user_id, batch_id)
);
create index account_notifications_recent_idx
  on public.account_notifications (user_id, created_at desc, batch_id desc);

alter table public.admin_notification_batches enable row level security;
alter table public.account_notifications enable row level security;
revoke all on public.admin_notification_batches, public.account_notifications from public, anon, authenticated;
grant select (batch_id, user_id, title, message, created_at, read_at), update (read_at)
  on public.account_notifications to authenticated;

create policy read_own_notifications on public.account_notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy mark_own_notifications_read on public.account_notifications
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and read_at is not null);

create function public.admin_profile_emails(profile_ids uuid[])
returns table (id uuid, email text)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users as u
  where u.id = any(profile_ids);
$$;
revoke all on function public.admin_profile_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_profile_emails(uuid[]) to service_role;

create function public.send_admin_notification(
  batch_key uuid, sender uuid, recipient uuid, notice_title text, notice_message text
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  sent integer;
  existing public.admin_notification_batches%rowtype;
begin
  insert into public.admin_notification_batches (id, sender_id, recipient_id, title, message)
  values (batch_key, sender, recipient, notice_title, notice_message)
  on conflict (id) do nothing;

  if not found then
    select * into strict existing from public.admin_notification_batches where id = batch_key;
    if existing.sender_id <> sender or existing.recipient_id is distinct from recipient
      or existing.title <> notice_title or existing.message <> notice_message then
      raise exception 'Notification request already used' using errcode = '22023';
    end if;
    return existing.recipient_count;
  end if;

  insert into public.account_notifications (batch_id, user_id, title, message)
  select batch_key, u.id, notice_title, notice_message
  from auth.users as u
  join public.profiles as p on p.id = u.id
  where u.email_confirmed_at is not null and (recipient is null or u.id = recipient);
  get diagnostics sent = row_count;

  update public.admin_notification_batches set recipient_count = sent where id = batch_key;
  return sent;
end;
$$;
revoke all on function public.send_admin_notification(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.send_admin_notification(uuid, uuid, uuid, text, text) to service_role;

commit;

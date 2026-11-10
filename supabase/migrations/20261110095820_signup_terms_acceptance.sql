begin;
create table public.signup_terms_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.signup_terms_acceptances enable row level security;
revoke all on public.signup_terms_acceptances from public, anon, authenticated;

create function public.record_signup_terms_acceptance()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  version text := new.raw_user_meta_data ->> 'terms_version';
begin
  -- BottleForMe registration uses email and password. Invitations and
  -- passwordless identities do not enter through the registration form.
  if new.raw_app_meta_data ->> 'provider' = 'email' and nullif(new.encrypted_password, '') is not null then
    if version is distinct from 'draft-1' then
      raise exception 'Accept the current BottleForMe terms to register.' using errcode = 'BF010';
    end if;
    insert into public.signup_terms_acceptances (user_id, terms_version) values (new.id, version);
  end if;
  return new;
end;
$$;
revoke all on function public.record_signup_terms_acceptance() from public, anon, authenticated;
create trigger record_signup_terms_acceptance after insert on auth.users
  for each row execute function public.record_signup_terms_acceptance();
commit;

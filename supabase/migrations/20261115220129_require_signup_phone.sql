create or replace function public.record_signup_terms_acceptance()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  version text := new.raw_user_meta_data ->> 'terms_version';
  phone_number text := new.raw_user_meta_data ->> 'phone';
begin
  if new.raw_app_meta_data ->> 'provider' = 'email' and nullif(new.encrypted_password, '') is not null then
    if version is distinct from 'draft-1' then
      raise exception 'Accept the current BottleForMe terms to register.' using errcode = 'BF010';
    end if;
    if coalesce(phone_number, '') !~ '^[+][1-9][0-9]{6,14}$' then
      raise exception 'Enter a valid mobile number.' using errcode = 'BF011';
    end if;
    insert into public.signup_terms_acceptances (user_id, terms_version) values (new.id, version);
  end if;
  return new;
end;
$$;

revoke all on function public.record_signup_terms_acceptance() from public, anon, authenticated;

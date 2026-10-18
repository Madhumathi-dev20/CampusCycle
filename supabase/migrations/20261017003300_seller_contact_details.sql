alter table public.profiles
  add column if not exists phone text,
  add column if not exists contact_email text;

alter table public.public_profiles
  add column if not exists phone text,
  add column if not exists contact_email text;

create or replace function public.sync_public_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.public_profiles (
    id, display_name, college_id, avatar_url, is_visible, phone, contact_email
  )
  values (
    new.id, new.display_name, new.college_id, new.avatar_url,
    new.account_status = 'active', new.phone, new.contact_email
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    college_id = excluded.college_id,
    avatar_url = excluded.avatar_url,
    is_visible = excluded.is_visible,
    phone = excluded.phone,
    contact_email = excluded.contact_email;
  return new;
end;
$$;

drop trigger if exists profiles_public_sync on public.profiles;
create trigger profiles_public_sync
after insert or update of display_name, college_id, avatar_url, account_status, phone, contact_email
on public.profiles
for each row execute function public.sync_public_profile();

insert into public.public_profiles (
  id, display_name, college_id, avatar_url, is_visible, phone, contact_email
)
select
  id, display_name, college_id, avatar_url, account_status = 'active', phone, contact_email
from public.profiles
on conflict (id) do update set
  display_name = excluded.display_name,
  college_id = excluded.college_id,
  avatar_url = excluded.avatar_url,
  is_visible = excluded.is_visible,
  phone = excluded.phone,
  contact_email = excluded.contact_email;

-- Contacts are stored for the detail RPC, not directly selectable from public profile rows.
revoke select on public.public_profiles from public, anon, authenticated;
revoke select (phone, contact_email) on public.public_profiles from public, anon, authenticated;
grant select (id, display_name, college_id, avatar_url, is_visible)
  on public.public_profiles to anon, authenticated;

grant update (phone, contact_email) on public.profiles to authenticated;

create or replace function public.get_listing_owner_contact(p_listing_id uuid)
returns table (owner_id uuid, phone text, contact_email text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.profiles viewer
    where viewer.id = auth.uid()
      and viewer.account_status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'Active account required';
  end if;

  return query
  select owner_profile.id, owner_profile.phone, owner_profile.contact_email
  from public.listings listing
  join public.profiles owner_profile on owner_profile.id = listing.owner_id
  join public.public_profiles public_owner on public_owner.id = owner_profile.id
  where listing.id = p_listing_id
    and listing.archived_at is null
    and listing.availability_status = 'available'
    and listing.moderation_status = 'active'
    and owner_profile.account_status = 'active'
    and public_owner.is_visible;
end;
$$;

revoke all on function public.get_listing_owner_contact(uuid) from public, anon;
grant execute on function public.get_listing_owner_contact(uuid) to authenticated;

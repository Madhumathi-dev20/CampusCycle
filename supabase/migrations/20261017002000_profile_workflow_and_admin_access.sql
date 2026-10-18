-- Keep account deactivation inside a narrow, authenticated workflow.
-- The trigger allows this transition only when set by the trusted RPC in this transaction.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  workflow boolean := coalesce(current_setting('campuscycle.workflow', true), '') = 'on';
begin
  if new.id is distinct from old.id or new.college_verified_at is distinct from old.college_verified_at then
    if not public.is_admin() then raise exception 'Protected profile fields cannot be changed'; end if;
  end if;
  if new.account_status is distinct from old.account_status and not public.is_admin() and not workflow then
    raise exception 'Protected profile fields cannot be changed';
  end if;
  return new;
end;
$$;

create or replace function public.deactivate_account()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active') then
    raise exception 'Active account required';
  end if;
  perform set_config('campuscycle.workflow', 'on', true);
  update public.profiles set account_status = 'deactivated' where id = auth.uid();
  update public.listings set availability_status = 'unavailable'
    where owner_id = auth.uid() and availability_status in ('draft','available');
  update public.requests set status = 'cancelled'
    where (requester_id = auth.uid() or owner_id = auth.uid()) and status = 'pending';
end;
$$;
revoke all on function public.deactivate_account() from public;
grant execute on function public.deactivate_account() to authenticated;

-- A suspension must also block further client-side writes, not just new request RPCs.
drop policy if exists "Users create drafts for themselves" on public.listings;
create policy "Active users create drafts for themselves" on public.listings for insert to authenticated
with check (owner_id = auth.uid() and availability_status = 'draft' and moderation_status = 'active'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active'));

drop policy if exists "Owners edit their listings" on public.listings;
create policy "Active owners edit their listings" on public.listings for update to authenticated
using ((owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active')) or public.is_admin())
with check ((owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active')) or public.is_admin());

drop policy if exists "Owners manage listing images" on public.listing_images;
create policy "Active owners manage listing images" on public.listing_images for insert to authenticated
with check (exists (select 1 from public.listings l join public.profiles p on p.id = l.owner_id
  where l.id = listing_id and l.owner_id = auth.uid() and p.account_status = 'active' and l.availability_status in ('draft','available')));

drop policy if exists "Owners delete listing images" on public.listing_images;
create policy "Active owners delete listing images" on public.listing_images for delete to authenticated
using (exists (select 1 from public.listings l join public.profiles p on p.id = l.owner_id
  where l.id = listing_id and l.owner_id = auth.uid() and p.account_status = 'active' and l.availability_status in ('draft','available')));

drop policy if exists "Users add to their wishlist" on public.wishlists;
create policy "Active users add to their wishlist" on public.wishlists for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active'));

-- Requests also reference the safe public projection so PostgREST can embed the
-- participants without exposing private profile columns through this relation.
alter table public.requests add constraint requests_requester_public_profile_fk
  foreign key (requester_id) references public.public_profiles(id) on delete restrict;
alter table public.requests add constraint requests_owner_public_profile_fk
  foreign key (owner_id) references public.public_profiles(id) on delete restrict;

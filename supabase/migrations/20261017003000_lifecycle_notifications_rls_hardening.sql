-- Harden lifecycle authorization and preserve participant access to transaction history.
-- This migration is additive so existing deployments can apply it after 20261017002000.

-- Anonymous catalog policies call this helper. For anon, auth.uid() is NULL so it safely returns false.
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from private.user_roles r
    join public.profiles p on p.id = r.user_id
    where r.user_id = auth.uid()
      and r.role = 'admin'
      and p.account_status = 'active'
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- This boolean helper reveals no other participant data and is only true for the caller's own relationship.
create or replace function public.is_listing_participant(p_listing_id uuid)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.requests r
    where r.listing_id = p_listing_id
      and auth.uid() in (r.requester_id, r.owner_id)
  );
$$;
revoke all on function public.is_listing_participant(uuid) from public;
grant execute on function public.is_listing_participant(uuid) to anon, authenticated;

-- Policy helper avoids recursive profile-table reads in active-account write policies.
create or replace function public.is_active_account()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active');
$$;
revoke all on function public.is_active_account() from public, anon;
grant execute on function public.is_active_account() to authenticated;

-- Internal guard used by the SECURITY DEFINER workflow RPCs.
create or replace function public.assert_workflow_account(p_allow_suspended boolean default false)
returns void
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare current_status public.account_status;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select p.account_status into current_status from public.profiles p where p.id = auth.uid();
  if current_status = 'active' or (p_allow_suspended and current_status = 'suspended') then return; end if;
  raise exception 'Active account required';
end;
$$;
revoke all on function public.assert_workflow_account(boolean) from public, anon, authenticated;

-- Archive keeps request/transaction foreign keys intact while removing the listing from discovery.
alter table public.listings add column archived_at timestamptz;

-- Report embeds use a safe profile projection with explicit PostgREST relationships.
alter table public.reports add constraint reports_reporter_public_profile_fk
  foreign key (reporter_id) references public.public_profiles(id) on delete restrict;
alter table public.reports add constraint reports_reported_user_public_profile_fk
  foreign key (reported_user_id) references public.public_profiles(id) on delete set null;

-- Admins can see hidden profile projections; other users only see active accounts.
drop policy if exists "Safe public profile fields are public" on public.public_profiles;
create policy "Safe public profile fields are public" on public.public_profiles for select to anon, authenticated
using (is_visible or public.is_admin());

-- Reserved and completed listings remain visible only to their participants, owner, and admins.
drop policy if exists "Listings are public when available" on public.listings;
create policy "Listings are public when available" on public.listings for select to anon, authenticated
using (
  (archived_at is null and availability_status = 'available' and moderation_status = 'active'
    and exists (select 1 from public.public_profiles p where p.id = owner_id and p.is_visible))
  or owner_id = auth.uid()
  or public.is_admin()
  or public.is_listing_participant(id)
);

drop policy if exists "Listing images readable with listing" on public.listing_images;
create policy "Listing images readable with listing" on public.listing_images for select to anon, authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (
        (l.archived_at is null and l.availability_status = 'available' and l.moderation_status = 'active'
          and exists (select 1 from public.public_profiles p where p.id = l.owner_id and p.is_visible))
        or l.owner_id = auth.uid()
        or public.is_admin()
        or public.is_listing_participant(l.id)
      )
  )
);

-- Search RPC honors RLS and explicitly excludes archived items from catalog results.
create or replace function public.search_listings(
  p_search text default null,
  p_listing_type public.listing_type default null,
  p_category_id uuid default null,
  p_college_id uuid default null,
  p_condition public.listing_condition default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_sort text default 'newest',
  p_offset integer default 0,
  p_limit integer default 12
)
returns setof public.listings
language sql stable security invoker set search_path = pg_catalog, public as $$
  select l.* from public.listings l
  where l.archived_at is null
    and l.availability_status = 'available'
    and l.moderation_status = 'active'
    and (nullif(trim(p_search), '') is null or (l.title ilike ('%' || trim(p_search) || '%') or l.description ilike ('%' || trim(p_search) || '%')))
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_category_id is null or l.category_id = p_category_id)
    and (p_college_id is null or l.college_id = p_college_id)
    and (p_condition is null or l.condition = p_condition)
    and (p_min_price is null or (l.listing_type = 'sell' and l.sale_price >= p_min_price))
    and (p_max_price is null or (l.listing_type = 'sell' and l.sale_price <= p_max_price))
  order by
    case when p_sort = 'price_asc' then l.sale_price end asc nulls last,
    case when p_sort = 'price_desc' then l.sale_price end desc nulls last,
    case when p_sort not in ('price_asc','price_desc') then l.created_at end desc nulls last,
    l.id
  offset greatest(p_offset, 0) limit least(greatest(p_limit, 1), 50);
$$;
revoke all on function public.search_listings(text, public.listing_type, uuid, uuid, public.listing_condition, numeric, numeric, text, integer, integer) from public;
grant execute on function public.search_listings(text, public.listing_type, uuid, uuid, public.listing_condition, numeric, numeric, text, integer, integer) to anon, authenticated;

-- Suspend direct profile and storage writes for non-active accounts as well as RPC writes.
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Active users update their own profile" on public.profiles for update to authenticated
using (id = auth.uid() and public.is_active_account())
with check ((id = auth.uid() and public.is_active_account()) or public.is_admin());

drop policy if exists "Students upload into own folder" on storage.objects;
create policy "Active students upload into own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_account());

drop policy if exists "Students update own images" on storage.objects;
create policy "Active students update own images" on storage.objects for update to authenticated
using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_account())
with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_account());

drop policy if exists "Students delete own images" on storage.objects;
create policy "Active students delete own images" on storage.objects for delete to authenticated
using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_account());

-- Existing requests and transactions retain their listing terms; no snapshot schema is needed.
create or replace function public.guard_listing_update()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  workflow boolean := coalesce(current_setting('campuscycle.workflow', true), '') = 'on';
  terms_changed boolean;
begin
  if new.owner_id is distinct from old.owner_id or new.moderation_status is distinct from old.moderation_status then
    if not public.is_admin() then raise exception 'Protected listing fields cannot be changed'; end if;
  end if;
  terms_changed := new.listing_type is distinct from old.listing_type
    or new.sale_price is distinct from old.sale_price
    or new.borrowing_fee is distinct from old.borrowing_fee
    or new.refundable_deposit is distinct from old.refundable_deposit
    or new.min_borrow_days is distinct from old.min_borrow_days
    or new.max_borrow_days is distinct from old.max_borrow_days;
  if terms_changed and not public.is_admin() and exists (
    select 1 from public.requests r where r.listing_id = old.id
  ) then
    raise exception 'Listing terms cannot change after a request has been submitted';
  end if;
  if new.availability_status is distinct from old.availability_status
     and new.availability_status in ('available', 'reserved', 'sold', 'donated')
     and not workflow and not public.is_admin() then
    raise exception 'Use the approved request workflow to change listing availability';
  end if;
  return new;
end;
$$;

-- Correct recipients and notification kinds for actor-driven status transitions.
create or replace function public.notify_request_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  target uuid;
  actor_text text;
  actor_id uuid;
  title_text text;
  body_text text;
  kind public.notification_type;
begin
  if tg_op = 'INSERT' then
    target := new.owner_id;
    kind := 'new_request';
    title_text := 'New ' || replace(new.request_type::text, '_', ' ') || ' request';
    body_text := 'A student sent a request for one of your listings.';
  elsif new.status is distinct from old.status then
    actor_text := nullif(current_setting('campuscycle.actor_id', true), '');
    if actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      actor_id := actor_text::uuid;
    end if;
    if actor_id = new.requester_id then
      target := new.owner_id;
    elsif actor_id = new.owner_id then
      target := new.requester_id;
    else
      target := case when new.status in ('accepted', 'rejected', 'handed_over', 'overdue') then new.requester_id else new.owner_id end;
    end if;
    kind := case new.status
      when 'accepted' then 'request_accepted'
      when 'rejected' then 'request_rejected'
      when 'cancelled' then 'request_cancelled'
      when 'handed_over' then 'handover_confirmed'
      when 'return_initiated' then 'return_initiated'
      when 'overdue' then 'item_overdue'
      when 'completed' then case when new.request_type = 'borrowing' then 'return_confirmed'::public.notification_type else 'completion_update'::public.notification_type end
      else 'completion_update'
    end;
    title_text := case kind
      when 'request_accepted' then 'Request accepted'
      when 'request_rejected' then 'Request declined'
      when 'request_cancelled' then 'Request cancelled'
      when 'handover_confirmed' then 'Handover recorded'
      when 'return_initiated' then 'Return initiated'
      when 'return_confirmed' then 'Return confirmed'
      when 'item_overdue' then 'Borrowed item overdue'
      else 'Request completed'
    end;
    body_text := case kind
      when 'item_overdue' then 'The owner reported that the borrowed item is overdue.'
      else 'The status of your request has changed to ' || replace(new.status::text, '_', ' ') || '.'
    end;
  else
    return new;
  end if;

  insert into public.notifications(recipient_id, type, title, message, related_listing_id, related_request_id)
  values (target, kind, title_text, body_text, new.listing_id, new.id);
  return new;
end;
$$;

-- Student lifecycle RPCs enforce status and participant rules inside the trusted boundary.
create or replace function public.submit_request(p_listing_id uuid, p_request_type public.request_type, p_start date default null, p_return date default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare l public.listings%rowtype; new_id uuid; required_type public.request_type;
begin
  perform public.assert_workflow_account(false);
  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.moderation_status <> 'active' or l.availability_status <> 'available' then raise exception 'Listing is not available'; end if;
  if l.owner_id = auth.uid() then raise exception 'You cannot request your own listing'; end if;
  if not exists (select 1 from public.profiles p where p.id = l.owner_id and p.account_status = 'active') then raise exception 'Listing owner account is not active'; end if;
  required_type := case l.listing_type when 'sell' then 'purchase'::public.request_type when 'donate' then 'donation'::public.request_type else 'borrowing'::public.request_type end;
  if p_request_type <> required_type then raise exception 'Request type does not match listing'; end if;
  if p_request_type = 'borrowing' then
    if p_start is null or p_return is null or p_start < current_date or p_return <= p_start then raise exception 'Choose a valid future borrowing period'; end if;
    if (p_return - p_start) < l.min_borrow_days or (p_return - p_start) > l.max_borrow_days then raise exception 'Requested duration is outside the owner’s allowed range'; end if;
    if exists (select 1 from public.requests r where r.listing_id = l.id and r.request_type = 'borrowing' and r.status in ('accepted','handed_over','return_initiated','overdue') and daterange(r.requested_start_date, r.requested_return_date + 1, '[)') && daterange(p_start, p_return + 1, '[)')) then raise exception 'Those dates overlap an approved borrowing period'; end if;
  elsif p_start is not null or p_return is not null then raise exception 'Dates are only accepted for borrowing';
  end if;
  insert into public.requests(listing_id, requester_id, owner_id, request_type, requested_start_date, requested_return_date, message)
  values (l.id, auth.uid(), l.owner_id, p_request_type, p_start, p_return, nullif(trim(p_message), '')) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.respond_to_request(p_request_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  r public.requests%rowtype;
  l public.listings%rowtype;
  kind public.transaction_type;
  price numeric;
  required_type public.request_type;
begin
  perform public.assert_workflow_account(false);
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'Request not found or access denied'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be answered'; end if;
  select * into l from public.listings where id = r.listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if p_accept then
    if not exists (select 1 from public.profiles p where p.id = r.requester_id and p.account_status = 'active') then raise exception 'Requester account is not active'; end if;
    if l.moderation_status <> 'active' or l.availability_status <> 'available' then raise exception 'Listing is no longer available'; end if;
    required_type := case l.listing_type when 'sell' then 'purchase'::public.request_type when 'donate' then 'donation'::public.request_type else 'borrowing'::public.request_type end;
    if r.request_type <> required_type then raise exception 'Request no longer matches the listing type'; end if;
    if r.request_type = 'borrowing' then
      if r.requested_start_date < current_date or r.requested_return_date <= r.requested_start_date
         or (r.requested_return_date - r.requested_start_date) < l.min_borrow_days
         or (r.requested_return_date - r.requested_start_date) > l.max_borrow_days then
        raise exception 'Borrowing dates are no longer valid';
      end if;
      if exists (select 1 from public.requests x where x.listing_id = r.listing_id and x.id <> r.id and x.request_type = 'borrowing' and x.status in ('accepted','handed_over','return_initiated','overdue') and daterange(x.requested_start_date, x.requested_return_date + 1, '[)') && daterange(r.requested_start_date, r.requested_return_date + 1, '[)')) then raise exception 'Those dates were just reserved by another request'; end if;
    end if;
    perform set_config('campuscycle.workflow', 'on', true);
    update public.listings set availability_status = 'reserved' where id = l.id and r.request_type <> 'borrowing';
    kind := case r.request_type when 'purchase' then 'sale'::public.transaction_type when 'donation' then 'donation'::public.transaction_type else 'borrowing'::public.transaction_type end;
    price := case when r.request_type = 'purchase' then l.sale_price when r.request_type = 'borrowing' then coalesce(l.borrowing_fee, 0) else 0 end;
    perform set_config('campuscycle.actor_id', auth.uid()::text, true);
    update public.requests set status = 'accepted' where id = r.id;
    insert into public.transactions(listing_id, request_id, buyer_or_borrower_id, owner_id, transaction_type, agreed_price)
    values (l.id, r.id, r.requester_id, r.owner_id, kind, price);
    if r.request_type <> 'borrowing' then
      update public.requests set status = 'rejected' where listing_id = l.id and id <> r.id and status = 'pending';
    end if;
  else
    perform set_config('campuscycle.actor_id', auth.uid()::text, true);
    update public.requests set status = 'rejected' where id = r.id;
  end if;
end;
$$;

create or replace function public.confirm_handover(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; r public.requests%rowtype;
begin
  perform public.assert_workflow_account(true);
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or t.owner_id <> auth.uid() then raise exception 'Only the item owner can mark handover'; end if;
  if t.handover_status <> 'pending' then raise exception 'Handover is already recorded'; end if;
  select * into r from public.requests where id = t.request_id for update;
  if r.status <> 'accepted' then raise exception 'Request is not ready for handover'; end if;
  update public.transactions set handover_status = 'completed' where id = t.id;
  perform set_config('campuscycle.actor_id', auth.uid()::text, true);
  update public.requests set status = 'handed_over' where id = r.id;
end;
$$;

create or replace function public.confirm_completion(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; new_owner boolean; new_requester boolean;
begin
  perform public.assert_workflow_account(true);
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or auth.uid() not in (t.owner_id, t.buyer_or_borrower_id) then raise exception 'Transaction access denied'; end if;
  if t.transaction_type = 'borrowing' then raise exception 'Use the return confirmation workflow for borrowed items'; end if;
  if t.handover_status <> 'completed' or t.completion_status = 'completed' then raise exception 'Handover must be recorded before completion'; end if;
  new_owner := t.owner_completion_confirmed or auth.uid() = t.owner_id;
  new_requester := t.requester_completion_confirmed or auth.uid() = t.buyer_or_borrower_id;
  update public.transactions set owner_completion_confirmed = new_owner, requester_completion_confirmed = new_requester,
    completion_status = case when new_owner and new_requester then 'completed' else 'pending' end,
    completed_at = case when new_owner and new_requester then now() else null end where id = t.id;
  if new_owner and new_requester then
    perform set_config('campuscycle.workflow', 'on', true);
    perform set_config('campuscycle.actor_id', auth.uid()::text, true);
    update public.requests set status = 'completed' where id = t.request_id;
    update public.listings set availability_status = case t.transaction_type when 'sale' then 'sold'::public.availability_status else 'donated'::public.availability_status end where id = t.listing_id;
  end if;
end;
$$;

create or replace function public.initiate_return(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; r public.requests%rowtype;
begin
  perform public.assert_workflow_account(true);
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or (auth.uid() <> t.owner_id and auth.uid() <> t.buyer_or_borrower_id) then raise exception 'Transaction access denied'; end if;
  if t.transaction_type <> 'borrowing' then raise exception 'Only borrowing transactions have returns'; end if;
  select * into r from public.requests where id = t.request_id for update;
  if r.status not in ('handed_over', 'overdue') then raise exception 'Item must be handed over before return'; end if;
  perform set_config('campuscycle.actor_id', auth.uid()::text, true);
  update public.requests set status = 'return_initiated' where id = r.id;
end;
$$;

create or replace function public.confirm_return(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; r public.requests%rowtype; new_owner boolean; new_requester boolean;
begin
  perform public.assert_workflow_account(true);
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or (auth.uid() <> t.owner_id and auth.uid() <> t.buyer_or_borrower_id) then raise exception 'Transaction access denied'; end if;
  if t.transaction_type <> 'borrowing' then raise exception 'Only borrowing transactions have returns'; end if;
  select * into r from public.requests where id = t.request_id for update;
  if r.status <> 'return_initiated' then raise exception 'Return must be initiated first'; end if;
  new_owner := t.owner_completion_confirmed or auth.uid() = t.owner_id;
  new_requester := t.requester_completion_confirmed or auth.uid() = t.buyer_or_borrower_id;
  update public.transactions set owner_completion_confirmed = new_owner, requester_completion_confirmed = new_requester,
    completion_status = case when new_owner and new_requester then 'completed' else 'pending' end,
    completed_at = case when new_owner and new_requester then now() else null end where id = t.id;
  if new_owner and new_requester then
    perform set_config('campuscycle.actor_id', auth.uid()::text, true);
    update public.requests set status = 'completed' where id = r.id;
  end if;
end;
$$;

create or replace function public.report_overdue(p_request_id uuid, p_description text default null)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.requests%rowtype;
begin
  perform public.assert_workflow_account(true);
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'Only the owner can report an overdue item'; end if;
  if r.request_type <> 'borrowing' or r.status <> 'handed_over' or r.requested_return_date >= current_date then raise exception 'This item is not overdue'; end if;
  perform set_config('campuscycle.actor_id', auth.uid()::text, true);
  update public.requests set status = 'overdue' where id = r.id;
  insert into public.reports(reporter_id, reported_user_id, listing_id, reason, description)
  values (auth.uid(), r.requester_id, r.listing_id, 'overdue_item', nullif(trim(p_description), ''));
end;
$$;

create or replace function public.cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.requests%rowtype;
begin
  perform public.assert_workflow_account(false);
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.requester_id <> auth.uid() then raise exception 'Request access denied'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be cancelled'; end if;
  perform set_config('campuscycle.actor_id', auth.uid()::text, true);
  update public.requests set status = 'cancelled' where id = r.id;
end;
$$;

create or replace function public.submit_report(p_listing_id uuid, p_reported_user_id uuid, p_reason public.report_reason, p_description text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare new_id uuid; listing_owner uuid;
begin
  perform public.assert_workflow_account(false);
  if p_listing_id is null and p_reported_user_id is null then raise exception 'A listing or user must be reported'; end if;
  if p_reported_user_id = auth.uid() then raise exception 'You cannot report yourself'; end if;
  if p_reason = 'overdue_item' then raise exception 'Use the overdue workflow to report a late return'; end if;
  if p_listing_id is not null then
    select l.owner_id into listing_owner from public.listings l where l.id = p_listing_id;
    if not found then raise exception 'Listing not found'; end if;
    if p_reported_user_id is not null and p_reported_user_id <> listing_owner then raise exception 'Reported user does not own this listing'; end if;
  end if;
  insert into public.reports(reporter_id, reported_user_id, listing_id, reason, description)
  values (auth.uid(), p_reported_user_id, p_listing_id, p_reason, nullif(trim(p_description), '')) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.publish_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare item public.listings%rowtype; image_count integer;
begin
  perform public.assert_workflow_account(false);
  select * into item from public.listings where id = p_listing_id and owner_id = auth.uid() for update;
  if not found or item.availability_status <> 'draft' then raise exception 'Draft listing not found'; end if;
  select count(*) into image_count from public.listing_images where listing_id = item.id;
  if image_count < 1 or image_count > 5 then raise exception 'Upload between one and five images before publishing'; end if;
  if item.listing_type = 'donate' and item.sale_price <> 0 then raise exception 'Donation listings must be free'; end if;
  perform set_config('campuscycle.workflow', 'on', true);
  update public.listings set availability_status = 'available' where id = item.id;
end;
$$;

-- Archive instead of deleting rows referenced by request/transaction history. Images remain available to participants.
create or replace function public.archive_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare item public.listings%rowtype;
begin
  perform public.assert_workflow_account(false);
  select * into item from public.listings where id = p_listing_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Listing not found'; end if;
  if item.availability_status not in ('draft', 'available', 'unavailable') then raise exception 'This listing cannot be archived while a transaction is in progress'; end if;
  if exists (select 1 from public.requests r where r.listing_id = item.id and r.status in ('accepted','handed_over','return_initiated','overdue')) then
    raise exception 'Complete the active transaction before archiving this listing';
  end if;
  perform set_config('campuscycle.workflow', 'on', true);
  perform set_config('campuscycle.actor_id', auth.uid()::text, true);
  update public.listings set availability_status = 'unavailable', archived_at = now()
    where id = item.id and availability_status <> 'unavailable' and archived_at is null;
  update public.listings set archived_at = now() where id = item.id and archived_at is null;
  update public.requests set status = 'cancelled' where listing_id = item.id and status = 'pending';
end;
$$;
revoke delete on public.listings from authenticated;
revoke all on function public.archive_listing(uuid) from public, anon;
grant execute on function public.archive_listing(uuid) to authenticated;

create or replace function public.restore_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare item public.listings%rowtype; image_count integer;
begin
  perform public.assert_workflow_account(false);
  select * into item from public.listings where id = p_listing_id and owner_id = auth.uid() for update;
  if not found or item.archived_at is null then raise exception 'Archived listing not found'; end if;
  if item.availability_status <> 'unavailable' then raise exception 'Only unavailable listings can be restored'; end if;
  if exists (select 1 from public.requests r where r.listing_id = item.id and r.status in ('accepted','handed_over','return_initiated','overdue')) then
    raise exception 'This listing has an active transaction and cannot be restored';
  end if;
  select count(*) into image_count from public.listing_images where listing_id = item.id;
  if image_count < 1 or image_count > 5 then raise exception 'The listing needs between one and five images before restoration'; end if;
  perform set_config('campuscycle.workflow', 'on', true);
  update public.listings set availability_status = 'available', archived_at = null where id = item.id;
end;
$$;
revoke all on function public.restore_listing(uuid) from public, anon;
grant execute on function public.restore_listing(uuid) to authenticated;

create or replace function public.deactivate_account()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.assert_workflow_account(false);
  if exists (select 1 from private.user_roles r where r.user_id = auth.uid()) then raise exception 'Revoke administrator access before deactivating this account'; end if;
  if exists (select 1 from public.requests r where (r.requester_id = auth.uid() or r.owner_id = auth.uid()) and r.status in ('accepted','handed_over','return_initiated','overdue')) then
    raise exception 'Finish active transactions before deactivating your account';
  end if;
  perform set_config('campuscycle.workflow', 'on', true);
  perform set_config('campuscycle.actor_id', auth.uid()::text, true);
  update public.profiles set account_status = 'deactivated' where id = auth.uid();
  update public.listings set availability_status = 'unavailable'
    where owner_id = auth.uid() and availability_status in ('draft','available');
  update public.requests set status = 'cancelled' where (requester_id = auth.uid() or owner_id = auth.uid()) and status = 'pending';
end;
$$;

create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare old_status public.account_status;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  select p.account_status into old_status from public.profiles p where p.id = p_user_id for update;
  if not found then raise exception 'User not found'; end if;
  if exists (select 1 from private.user_roles r where r.user_id = p_user_id) and p_status <> 'active' then
    raise exception 'Revoke administrator access through trusted operations before changing this account status';
  end if;
  if p_status = 'deactivated' and exists (
    select 1 from public.requests r where (r.requester_id = p_user_id or r.owner_id = p_user_id) and r.status in ('accepted','handed_over','return_initiated','overdue')
  ) then raise exception 'Finish active transactions before deactivating this account'; end if;
  if old_status = p_status then return; end if;

  update public.profiles set account_status = p_status where id = p_user_id;
  if p_status <> 'active' then
    -- The profile trigger hides public listing/profile access without losing availability on reinstatement.
    perform set_config('campuscycle.actor_id', p_user_id::text, true);
    update public.requests set status = 'cancelled'
      where (requester_id = p_user_id or owner_id = p_user_id) and status = 'pending';
  end if;
  insert into public.notifications(recipient_id, type, title, message)
  values (p_user_id, 'account_update', 'Account status updated', 'Your account status was changed by a platform administrator.');
end;
$$;

-- The current image bucket is public; metadata RLS does not make known object URLs private.
-- Keep its current storage behavior, but document it as a public asset until a private-bucket migration is designed.

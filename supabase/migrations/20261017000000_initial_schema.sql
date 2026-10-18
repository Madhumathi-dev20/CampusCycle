-- CampusCycle initial schema. Apply with: supabase db push
-- All client-facing tables use RLS. Privileged workflows run through narrow RPCs.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.account_status as enum ('active', 'suspended', 'deactivated');
create type public.listing_type as enum ('sell', 'donate', 'borrow');
create type public.listing_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
create type public.availability_status as enum ('draft', 'available', 'reserved', 'sold', 'donated', 'unavailable');
create type public.request_type as enum ('purchase', 'donation', 'borrowing');
create type public.request_status as enum ('pending', 'accepted', 'rejected', 'cancelled', 'handed_over', 'return_initiated', 'completed', 'overdue');
create type public.transaction_type as enum ('sale', 'donation', 'borrowing');
create type public.report_status as enum ('open', 'under_review', 'resolved', 'dismissed');
create type public.report_reason as enum ('fraud', 'prohibited_item', 'misleading_listing', 'harassment', 'overdue_item', 'other');
create type public.notification_type as enum ('new_request', 'request_accepted', 'request_rejected', 'request_cancelled', 'handover_confirmed', 'completion_update', 'return_initiated', 'return_confirmed', 'item_overdue', 'listing_moderated', 'account_update');

create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 160),
  location text not null default '',
  verification_domains text[] not null default '{}',
  verification_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 80),
  description text,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Student-private profile fields are readable only by the profile owner and admins.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 50),
  college_id uuid references public.colleges(id) on delete set null,
  branch text check (branch is null or length(branch) <= 100),
  semester smallint check (semester is null or semester between 1 and 12),
  avatar_url text,
  account_status public.account_status not null default 'active',
  college_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- This intentionally contains only fields safe to show on public listing cards.
create table public.public_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null,
  college_id uuid references public.colleges(id) on delete set null,
  avatar_url text
);

-- Roles are kept outside the profile table and cannot be edited by students.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null
);
revoke all on private.user_roles from public, anon, authenticated;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  college_id uuid not null references public.colleges(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 120),
  description text not null check (length(trim(description)) between 10 and 3000),
  listing_type public.listing_type not null,
  condition public.listing_condition not null,
  sale_price numeric(10,2),
  borrowing_fee numeric(10,2),
  refundable_deposit numeric(10,2),
  min_borrow_days integer,
  max_borrow_days integer,
  availability_status public.availability_status not null default 'draft',
  moderation_status text not null default 'active' check (moderation_status in ('active', 'removed')),
  exchange_location text check (exchange_location is null or length(exchange_location) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_price_by_type check (
    (listing_type = 'sell' and sale_price is not null and sale_price >= 0 and borrowing_fee is null and refundable_deposit is null and min_borrow_days is null and max_borrow_days is null)
    or (listing_type = 'donate' and sale_price = 0 and borrowing_fee is null and refundable_deposit is null and min_borrow_days is null and max_borrow_days is null)
    or (listing_type = 'borrow' and sale_price is null and (borrowing_fee is null or borrowing_fee >= 0) and (refundable_deposit is null or refundable_deposit >= 0) and min_borrow_days >= 1 and max_borrow_days >= min_borrow_days)
  )
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique check (length(storage_path) <= 500),
  display_order smallint not null default 0 check (display_order between 0 and 9),
  created_at timestamptz not null default now(),
  unique (listing_id, display_order)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  requester_id uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  request_type public.request_type not null,
  requested_start_date date,
  requested_return_date date,
  message text check (message is null or length(message) <= 1000),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> owner_id),
  check ((request_type = 'borrowing' and requested_start_date is not null and requested_return_date is not null and requested_return_date > requested_start_date) or (request_type <> 'borrowing' and requested_start_date is null and requested_return_date is null)),
  -- Approved, active, and overdue loans occupy an inclusive date interval.
  exclude using gist (
    listing_id with =,
    daterange(requested_start_date, requested_return_date + 1, '[)') with &&
  ) where (request_type = 'borrowing' and status in ('accepted', 'handed_over', 'return_initiated', 'overdue'))
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  request_id uuid not null unique references public.requests(id) on delete restrict,
  buyer_or_borrower_id uuid not null references public.profiles(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  transaction_type public.transaction_type not null,
  agreed_price numeric(10,2) check (agreed_price is null or agreed_price >= 0),
  handover_status text not null default 'pending' check (handover_status in ('pending', 'completed')),
  completion_status text not null default 'pending' check (completion_status in ('pending', 'completed')),
  owner_completion_confirmed boolean not null default false,
  requester_completion_confirmed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (buyer_or_borrower_id <> owner_id)
);

create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reported_user_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  reason public.report_reason not null,
  description text check (description is null or length(description) <= 2000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null check (length(title) between 1 and 120),
  message text not null check (length(message) between 1 and 500),
  related_listing_id uuid references public.listings(id) on delete set null,
  related_request_id uuid references public.requests(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index listings_public_search_idx on public.listings (availability_status, moderation_status, created_at desc);
create index listings_owner_idx on public.listings (owner_id, created_at desc);
create index listings_college_type_idx on public.listings (college_id, listing_type, availability_status);
create index listings_category_idx on public.listings (category_id, availability_status);
create index listings_price_idx on public.listings (sale_price) where listing_type = 'sell';
create index listings_title_search_idx on public.listings using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
create index listing_images_listing_order_idx on public.listing_images (listing_id, display_order);
create index requests_requester_idx on public.requests (requester_id, created_at desc);
create index requests_owner_idx on public.requests (owner_id, created_at desc);
create index requests_listing_status_idx on public.requests (listing_id, status);
create index transactions_owner_idx on public.transactions (owner_id, created_at desc);
create index transactions_requester_idx on public.transactions (buyer_or_borrower_id, created_at desc);
create index wishlists_user_idx on public.wishlists (user_id, created_at desc);
create index reports_status_idx on public.reports (status, created_at desc);
create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select exists (select 1 from private.user_roles r where r.user_id = auth.uid() and r.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare display text;
begin
  display := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));
  insert into public.profiles (id, display_name)
  values (new.id, left(display, 50))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.sync_public_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.account_status = 'active' then
    insert into public.public_profiles (id, display_name, college_id, avatar_url)
    values (new.id, new.display_name, new.college_id, new.avatar_url)
    on conflict (id) do update set display_name = excluded.display_name, college_id = excluded.college_id, avatar_url = excluded.avatar_url;
  else
    delete from public.public_profiles where id = new.id;
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if new.id is distinct from old.id or new.account_status is distinct from old.account_status or new.college_verified_at is distinct from old.college_verified_at then
    if not public.is_admin() then raise exception 'Protected profile fields cannot be changed'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.guard_listing_update()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare workflow boolean := coalesce(current_setting('campuscycle.workflow', true), '') = 'on';
begin
  if new.owner_id is distinct from old.owner_id or new.moderation_status is distinct from old.moderation_status then
    if not public.is_admin() then raise exception 'Protected listing fields cannot be changed'; end if;
  end if;
  if new.availability_status is distinct from old.availability_status
     and new.availability_status in ('available', 'reserved', 'sold', 'donated')
     and not workflow and not public.is_admin() then
    raise exception 'Use the approved request workflow to change listing availability';
  end if;
  return new;
end;
$$;

create trigger auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();
create trigger profiles_public_sync after insert or update of display_name, college_id, avatar_url, account_status on public.profiles for each row execute function public.sync_public_profile();
create trigger listings_updated_at before update on public.listings for each row execute function public.touch_updated_at();
create trigger listings_guard before update on public.listings for each row execute function public.guard_listing_update();
create trigger requests_updated_at before update on public.requests for each row execute function public.touch_updated_at();

-- Notifications are generated inside the database so request status changes cannot bypass them.
create or replace function public.notify_request_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare target uuid; title_text text; body_text text; kind public.notification_type;
begin
  if tg_op = 'INSERT' then
    target := new.owner_id;
    kind := 'new_request';
    title_text := 'New ' || replace(new.request_type::text, '_', ' ') || ' request';
    body_text := 'A student sent a request for one of your listings.';
  elsif new.status is distinct from old.status then
    target := case when new.status in ('accepted', 'rejected') then new.requester_id else new.owner_id end;
    kind := case new.status when 'accepted' then 'request_accepted' when 'rejected' then 'request_rejected' when 'cancelled' then 'request_cancelled' when 'handed_over' then 'handover_confirmed' when 'return_initiated' then 'return_initiated' when 'overdue' then 'item_overdue' when 'completed' then 'return_confirmed' else 'completion_update' end;
    title_text := 'Request update';
    body_text := 'The status of your request has changed to ' || replace(new.status::text, '_', ' ') || '.';
  else return new;
  end if;
  insert into public.notifications(recipient_id, type, title, message, related_listing_id, related_request_id)
  values (target, kind, title_text, body_text, new.listing_id, new.id);
  return new;
end;
$$;
create trigger requests_notify after insert or update of status on public.requests for each row execute function public.notify_request_change();

-- Narrow RPCs enforce requester/owner identity and perform each workflow atomically.
create or replace function public.submit_request(p_listing_id uuid, p_request_type public.request_type, p_start date default null, p_return date default null, p_message text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare l public.listings%rowtype; new_id uuid; required_type public.request_type;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into l from public.listings where id = p_listing_id for update;
  if not found or l.moderation_status <> 'active' or l.availability_status <> 'available' then raise exception 'Listing is not available'; end if;
  if l.owner_id = auth.uid() then raise exception 'You cannot request your own listing'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.account_status = 'active') then raise exception 'Active account required'; end if;
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
declare r public.requests%rowtype; l public.listings%rowtype; kind public.transaction_type; price numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'Request not found or access denied'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be answered'; end if;
  select * into l from public.listings where id = r.listing_id for update;
  if p_accept then
    if l.moderation_status <> 'active' or l.availability_status <> 'available' then raise exception 'Listing is no longer available'; end if;
    if r.request_type = 'borrowing' and exists (select 1 from public.requests x where x.listing_id = r.listing_id and x.id <> r.id and x.request_type = 'borrowing' and x.status in ('accepted','handed_over','return_initiated','overdue') and daterange(x.requested_start_date, x.requested_return_date + 1, '[)') && daterange(r.requested_start_date, r.requested_return_date + 1, '[)')) then raise exception 'Those dates were just reserved by another request'; end if;
    if r.request_type <> 'borrowing' then
      perform set_config('campuscycle.workflow', 'on', true);
      update public.listings set availability_status = 'reserved' where id = l.id;
    end if;
    update public.requests set status = 'accepted' where id = r.id;
    kind := case r.request_type when 'purchase' then 'sale'::public.transaction_type when 'donation' then 'donation'::public.transaction_type else 'borrowing'::public.transaction_type end;
    price := case when r.request_type = 'purchase' then l.sale_price when r.request_type = 'borrowing' then coalesce(l.borrowing_fee, 0) else 0 end;
    insert into public.transactions(listing_id, request_id, buyer_or_borrower_id, owner_id, transaction_type, agreed_price)
    values (l.id, r.id, r.requester_id, r.owner_id, kind, price);
    if r.request_type <> 'borrowing' then
      update public.requests set status = 'rejected' where listing_id = l.id and id <> r.id and status = 'pending';
    end if;
  else
    update public.requests set status = 'rejected' where id = r.id;
  end if;
end;
$$;

create or replace function public.confirm_handover(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or t.owner_id <> auth.uid() then raise exception 'Only the item owner can mark handover'; end if;
  if t.handover_status <> 'pending' then raise exception 'Handover is already recorded'; end if;
  update public.transactions set handover_status = 'completed' where id = t.id;
  update public.requests set status = 'handed_over' where id = t.request_id and status = 'accepted';
end;
$$;

create or replace function public.confirm_completion(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; new_owner boolean; new_requester boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
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
    update public.requests set status = 'completed' where id = t.request_id;
    perform set_config('campuscycle.workflow', 'on', true);
    update public.listings set availability_status = case t.transaction_type when 'sale' then 'sold'::public.availability_status else 'donated'::public.availability_status end where id = t.listing_id;
  end if;
end;
$$;

create or replace function public.initiate_return(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; r public.requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into t from public.transactions where id = p_transaction_id for update;
  if not found or (auth.uid() <> t.owner_id and auth.uid() <> t.buyer_or_borrower_id) then raise exception 'Transaction access denied'; end if;
  if t.transaction_type <> 'borrowing' then raise exception 'Only borrowing transactions have returns'; end if;
  select * into r from public.requests where id = t.request_id for update;
  if r.status not in ('handed_over', 'overdue') then raise exception 'Item must be handed over before return'; end if;
  update public.requests set status = 'return_initiated' where id = r.id;
end;
$$;

create or replace function public.confirm_return(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare t public.transactions%rowtype; r public.requests%rowtype; new_owner boolean; new_requester boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
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
  if new_owner and new_requester then update public.requests set status = 'completed' where id = r.id; end if;
end;
$$;

create or replace function public.report_overdue(p_request_id uuid, p_description text default null)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'Only the owner can report an overdue item'; end if;
  if r.request_type <> 'borrowing' or r.status <> 'handed_over' or r.requested_return_date >= current_date then raise exception 'This item is not overdue'; end if;
  update public.requests set status = 'overdue' where id = r.id;
  insert into public.reports(reporter_id, reported_user_id, listing_id, reason, description)
  values (auth.uid(), r.requester_id, r.listing_id, 'overdue_item', nullif(trim(p_description), ''));
end;
$$;

create or replace function public.cancel_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare r public.requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into r from public.requests where id = p_request_id for update;
  if not found or r.requester_id <> auth.uid() then raise exception 'Request access denied'; end if;
  if r.status <> 'pending' then raise exception 'Only pending requests can be cancelled'; end if;
  update public.requests set status = 'cancelled' where id = r.id;
end;
$$;

create or replace function public.submit_report(p_listing_id uuid, p_reported_user_id uuid, p_reason public.report_reason, p_description text default null)
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_listing_id is null and p_reported_user_id is null then raise exception 'A listing or user must be reported'; end if;
  if p_reported_user_id = auth.uid() then raise exception 'You cannot report yourself'; end if;
  if p_listing_id is not null and not exists (select 1 from public.listings where id = p_listing_id) then raise exception 'Listing not found'; end if;
  insert into public.reports(reporter_id, reported_user_id, listing_id, reason, description)
  values (auth.uid(), p_reported_user_id, p_listing_id, p_reason, nullif(trim(p_description), '')) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = pg_catalog, public as $$
  update public.notifications set is_read = true where id = p_notification_id and recipient_id = auth.uid();
$$;

create or replace function public.publish_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.listings where id = p_listing_id and owner_id = auth.uid() and availability_status = 'draft') then raise exception 'Draft listing not found'; end if;
  if not exists (select 1 from public.listing_images where listing_id = p_listing_id) then raise exception 'Upload at least one image before publishing'; end if;
  perform set_config('campuscycle.workflow', 'on', true);
  update public.listings set availability_status = 'available' where id = p_listing_id;
end;
$$;

-- Admin-only RPCs. Granting admin role itself is intentionally a manual SQL operation.
create or replace function public.admin_set_account_status(p_user_id uuid, p_status public.account_status)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status = 'active' and exists (select 1 from private.user_roles where user_id = p_user_id) then raise exception 'Cannot change administrator account status here'; end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then raise exception 'User not found'; end if;
  insert into public.notifications(recipient_id, type, title, message) values (p_user_id, 'account_update', 'Account status updated', 'Your account status was changed by a platform administrator.');
end;
$$;

create or replace function public.admin_moderate_listing(p_listing_id uuid, p_remove boolean)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare owner uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.listings set moderation_status = case when p_remove then 'removed' else 'active' end where id = p_listing_id returning owner_id into owner;
  if not found then raise exception 'Listing not found'; end if;
  if p_remove then insert into public.notifications(recipient_id, type, title, message, related_listing_id) values (owner, 'listing_moderated', 'Listing removed', 'An administrator removed a listing that violates the community guidelines.', p_listing_id); end if;
end;
$$;

create or replace function public.admin_update_report(p_report_id uuid, p_status public.report_status)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.reports set status = p_status, resolved_at = case when p_status in ('resolved','dismissed') then now() else null end where id = p_report_id;
  if not found then raise exception 'Report not found'; end if;
end;
$$;

-- RLS
alter table public.colleges enable row level security;
alter table public.categories enable row level security;
alter table public.profiles enable row level security;
alter table public.public_profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.requests enable row level security;
alter table public.transactions enable row level security;
alter table public.wishlists enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create policy "Colleges are public read" on public.colleges for select to anon, authenticated using (true);
create policy "Admins manage colleges" on public.colleges for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Active categories are public read" on public.categories for select to anon, authenticated using (is_active or public.is_admin());
create policy "Admins manage categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Users read their own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "Users create their own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "Users update their own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy "Safe public profile fields are public" on public.public_profiles for select to anon, authenticated using (true);
create policy "Listings are public when available" on public.listings for select to anon, authenticated using ((availability_status = 'available' and moderation_status = 'active') or owner_id = auth.uid() or public.is_admin());
create policy "Users create drafts for themselves" on public.listings for insert to authenticated with check (owner_id = auth.uid() and availability_status = 'draft' and moderation_status = 'active');
create policy "Owners edit their listings" on public.listings for update to authenticated using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "Owners delete listings without active transactions" on public.listings for delete to authenticated using (owner_id = auth.uid() and not exists (select 1 from public.requests r where r.listing_id = listings.id and r.status in ('accepted','handed_over','return_initiated','overdue')));
create policy "Listing images readable with listing" on public.listing_images for select to anon, authenticated using (exists (select 1 from public.listings l where l.id = listing_id and ((l.availability_status = 'available' and l.moderation_status = 'active') or l.owner_id = auth.uid() or public.is_admin())));
create policy "Owners manage listing images" on public.listing_images for insert to authenticated with check (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid() and l.availability_status in ('draft','available')));
create policy "Owners delete listing images" on public.listing_images for delete to authenticated using (exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid() and l.availability_status in ('draft','available')));
create policy "Participants read requests" on public.requests for select to authenticated using (requester_id = auth.uid() or owner_id = auth.uid() or public.is_admin());
create policy "Requester submits pending requests" on public.requests for insert to authenticated with check (requester_id = auth.uid() and status = 'pending' and owner_id <> auth.uid());
create policy "Participants read transactions" on public.transactions for select to authenticated using (buyer_or_borrower_id = auth.uid() or owner_id = auth.uid() or public.is_admin());
create policy "Users manage their wishlist" on public.wishlists for select to authenticated using (user_id = auth.uid());
create policy "Users add to their wishlist" on public.wishlists for insert to authenticated with check (user_id = auth.uid());
create policy "Users remove from their wishlist" on public.wishlists for delete to authenticated using (user_id = auth.uid());
create policy "Users submit reports" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "Reporters and admins read reports" on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "Admins update reports" on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Recipients read notifications" on public.notifications for select to authenticated using (recipient_id = auth.uid() or public.is_admin());
create policy "Recipients update notifications" on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Grant only what is needed. No client can write workflow state directly on requests/transactions.
grant select on public.colleges, public.categories, public.public_profiles, public.listings, public.listing_images to anon, authenticated;
grant insert, update, delete on public.colleges, public.categories to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.listings to authenticated;
grant insert, delete on public.listing_images to authenticated;
grant select, insert on public.requests to authenticated;
grant select on public.transactions to authenticated;
grant select, insert, delete on public.wishlists to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, update on public.notifications to authenticated;

-- RPC permissions (security definer functions still validate auth.uid() and roles internally).
revoke all on function public.submit_request(uuid, public.request_type, date, date, text) from public;
revoke all on function public.respond_to_request(uuid, boolean) from public;
revoke all on function public.confirm_handover(uuid) from public;
revoke all on function public.confirm_completion(uuid) from public;
revoke all on function public.initiate_return(uuid) from public;
revoke all on function public.confirm_return(uuid) from public;
revoke all on function public.report_overdue(uuid, text) from public;
revoke all on function public.cancel_request(uuid) from public;
revoke all on function public.submit_report(uuid, uuid, public.report_reason, text) from public;
revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.publish_listing(uuid) from public;
revoke all on function public.admin_set_account_status(uuid, public.account_status) from public;
revoke all on function public.admin_moderate_listing(uuid, boolean) from public;
revoke all on function public.admin_update_report(uuid, public.report_status) from public;
grant execute on function public.submit_request(uuid, public.request_type, date, date, text) to authenticated;
grant execute on function public.respond_to_request(uuid, boolean) to authenticated;
grant execute on function public.confirm_handover(uuid) to authenticated;
grant execute on function public.confirm_completion(uuid) to authenticated;
grant execute on function public.initiate_return(uuid) to authenticated;
grant execute on function public.confirm_return(uuid) to authenticated;
grant execute on function public.report_overdue(uuid, text) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
grant execute on function public.submit_report(uuid, uuid, public.report_reason, text) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.publish_listing(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status) to authenticated;
grant execute on function public.admin_moderate_listing(uuid, boolean) to authenticated;
grant execute on function public.admin_update_report(uuid, public.report_status) to authenticated;

-- Public reads are restricted to image files; writes are scoped to a user's uid folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Public can view listing images" on storage.objects for select to anon, authenticated using (bucket_id = 'listing-images');
create policy "Students upload into own folder" on storage.objects for insert to authenticated with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Students update own images" on storage.objects for update to authenticated using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Students delete own images" on storage.objects for delete to authenticated using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

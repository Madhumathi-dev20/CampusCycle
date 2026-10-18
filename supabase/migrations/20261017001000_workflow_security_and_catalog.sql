-- Tighten workflow and public profile boundaries; add safe search/stat RPCs.

-- Enforce non-null listing terms: PostgreSQL CHECK constraints accept NULL expressions.
alter table public.listings drop constraint listing_price_by_type;
alter table public.listings add constraint listing_price_by_type check (
  (listing_type = 'sell' and sale_price is not null and sale_price >= 0 and borrowing_fee is null and refundable_deposit is null and min_borrow_days is null and max_borrow_days is null)
  or (listing_type = 'donate' and sale_price is not null and sale_price = 0 and borrowing_fee is null and refundable_deposit is null and min_borrow_days is null and max_borrow_days is null)
  or (listing_type = 'borrow' and sale_price is null and (borrowing_fee is null or borrowing_fee >= 0) and (refundable_deposit is null or refundable_deposit >= 0) and min_borrow_days is not null and max_borrow_days is not null and min_borrow_days >= 1 and max_borrow_days >= min_borrow_days)
);

-- Public profile rows remain as FK targets, but their RLS policy hides suspended accounts.
alter table public.public_profiles add column is_visible boolean not null default true;

create or replace function public.sync_public_profile()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  insert into public.public_profiles (id, display_name, college_id, avatar_url, is_visible)
  values (new.id, new.display_name, new.college_id, new.avatar_url, new.account_status = 'active')
  on conflict (id) do update set display_name = excluded.display_name, college_id = excluded.college_id, avatar_url = excluded.avatar_url, is_visible = excluded.is_visible;
  return new;
end;
$$;
insert into public.public_profiles (id, display_name, college_id, avatar_url, is_visible)
select id, display_name, college_id, avatar_url, account_status = 'active' from public.profiles
on conflict (id) do update set display_name = excluded.display_name, college_id = excluded.college_id, avatar_url = excluded.avatar_url, is_visible = excluded.is_visible;
alter table public.listings add constraint listings_owner_public_profile_fk foreign key (owner_id) references public.public_profiles(id) on delete restrict;

-- A profile is created by the auth trigger. Metadata is validated, but cannot set role/status.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  display text;
  college_value uuid;
  branch_value text;
  semester_value smallint;
begin
  display := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));
  if coalesce(new.raw_user_meta_data ->> 'college_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into college_value from public.colleges where id = (new.raw_user_meta_data ->> 'college_id')::uuid;
  end if;
  branch_value := nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'branch', '')), 100), '');
  begin
    semester_value := nullif(new.raw_user_meta_data ->> 'semester', '')::smallint;
    if semester_value not between 1 and 12 then semester_value := null; end if;
  exception when others then semester_value := null;
  end;
  insert into public.profiles (id, display_name, college_id, branch, semester)
  values (new.id, left(display, 50), college_value, branch_value, semester_value)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- The client cannot create/update workflow or protected fields directly.
drop policy if exists "Users create their own profile" on public.profiles;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, college_id, branch, semester, avatar_url) on public.profiles to authenticated;

revoke update on public.listings from authenticated;
grant update (college_id, category_id, title, description, listing_type, condition, sale_price, borrowing_fee, refundable_deposit, min_borrow_days, max_borrow_days, exchange_location) on public.listings to authenticated;

-- Requests must be submitted through submit_request(); status changes are RPC-only.
drop policy if exists "Requester submits pending requests" on public.requests;
revoke insert, update, delete on public.requests from authenticated;
revoke insert, update, delete on public.transactions from authenticated;

-- Reports are submitted through the validating RPC; only admins can update moderation status.
revoke insert, update, delete on public.reports from authenticated;
revoke update on public.notifications from authenticated;
grant select on public.reports to authenticated;
grant select on public.notifications to authenticated;

-- Enforce image count/ownership constraints at publish time.
create or replace function public.publish_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare item public.listings%rowtype; image_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into item from public.listings where id = p_listing_id and owner_id = auth.uid() for update;
  if not found or item.availability_status <> 'draft' then raise exception 'Draft listing not found'; end if;
  select count(*) into image_count from public.listing_images where listing_id = item.id;
  if image_count < 1 or image_count > 5 then raise exception 'Upload between one and five images before publishing'; end if;
  if item.listing_type = 'donate' and item.sale_price <> 0 then raise exception 'Donation listings must be free'; end if;
  perform set_config('campuscycle.workflow', 'on', true);
  update public.listings set availability_status = 'available' where id = item.id;
end;
$$;

create or replace function public.deactivate_account()
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.profiles set account_status = 'deactivated' where id = auth.uid();
  perform set_config('campuscycle.workflow', 'on', true);
  update public.listings set availability_status = 'unavailable'
    where owner_id = auth.uid() and availability_status in ('draft','available');
  -- Owner-side pending requests remain visible for an active, accepted borrowing/sale history.
  -- Pending inbound requests are cancelled before deactivation, avoiding stale requests.
  update public.requests set status = 'cancelled'
    where (requester_id = auth.uid() or owner_id = auth.uid()) and status = 'pending';
end;
$$;

create or replace function public.platform_stats()
returns table (total_listings bigint, total_users bigint, total_donations bigint, total_borrows bigint)
language sql stable security definer set search_path = pg_catalog, public as $$
  select
    count(*) filter (where l.availability_status = 'available' and l.moderation_status = 'active'),
    (select count(*) from public.profiles p where p.account_status = 'active'),
    count(*) filter (where l.availability_status = 'available' and l.moderation_status = 'active' and l.listing_type = 'donate'),
    count(*) filter (where l.availability_status = 'available' and l.moderation_status = 'active' and l.listing_type = 'borrow')
  from public.listings l;
$$;

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
  where l.availability_status = 'available'
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

-- Mark read is a narrow, recipient-scoped write.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security definer set search_path = pg_catalog, public as $$
  update public.notifications set is_read = true where id = p_notification_id and recipient_id = auth.uid();
$$;

-- Public listing access must not include suspended owners' listings.
drop policy if exists "Listings are public when available" on public.listings;
create policy "Listings are public when available" on public.listings for select to anon, authenticated
using (
  (availability_status = 'available' and moderation_status = 'active' and exists (select 1 from public.public_profiles p where p.id = owner_id and p.is_visible))
  or owner_id = auth.uid() or public.is_admin()
);
drop policy if exists "Safe public profile fields are public" on public.public_profiles;
create policy "Safe public profile fields are public" on public.public_profiles for select to anon, authenticated
using (is_visible);

-- Seed the canonical category list. College records are intentionally operator-provided, never fabricated.
insert into public.categories (name, description, icon) values
  ('Books & Textbooks', 'Textbooks, reference books, and course readers', 'book-open'),
  ('Academic Notes', 'Student notes, guides, and study materials', 'notebook-pen'),
  ('Calculators', 'Scientific, graphing, and financial calculators', 'calculator'),
  ('Electronics', 'Laptops, accessories, and other electronics', 'laptop'),
  ('Lab Equipment', 'Lab tools, kits, and protective equipment', 'flask-conical'),
  ('Drawing Instruments', 'Drawing boards, geometry kits, and instruments', 'ruler'),
  ('Hostel Essentials', 'Useful items for dorm and hostel life', 'house'),
  ('Other Resources', 'Other useful campus resources', 'package')
on conflict (name) do update set description = excluded.description, icon = excluded.icon, is_active = true;

revoke all on function public.platform_stats() from public;
grant execute on function public.platform_stats() to anon, authenticated;
revoke all on function public.search_listings(text, public.listing_type, uuid, uuid, public.listing_condition, numeric, numeric, text, integer, integer) from public;
grant execute on function public.search_listings(text, public.listing_type, uuid, uuid, public.listing_condition, numeric, numeric, text, integer, integer) to anon, authenticated;
revoke all on function public.deactivate_account() from public;
grant execute on function public.deactivate_account() to authenticated;

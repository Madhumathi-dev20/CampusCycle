create or replace function public.resolve_college_id(p_name text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  college_name text := nullif(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  college_value uuid;
begin
  if college_name is null or length(college_name) < 2 or length(college_name) > 160 then
    raise exception 'College name must be between 2 and 160 characters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(lower(college_name), 0));

  select id into college_value
  from public.colleges
  where lower(regexp_replace(trim(name), '\s+', ' ', 'g')) = lower(college_name)
  order by created_at, id
  limit 1;

  if college_value is null then
    insert into public.colleges (name)
    values (college_name)
    returning id into college_value;
  end if;

  return college_value;
end;
$$;
revoke all on function public.resolve_college_id(text) from public, anon;
grant execute on function public.resolve_college_id(text) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  display text;
  college_value uuid;
  college_name text;
  branch_value text;
  semester_value smallint;
begin
  display := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));
  college_name := nullif(trim(new.raw_user_meta_data ->> 'college_name'), '');

  if college_name is not null then
    college_value := public.resolve_college_id(college_name);
  elsif coalesce(new.raw_user_meta_data ->> 'college_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
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

drop function public.search_listings(text, public.listing_type, uuid, uuid, public.listing_condition, numeric, numeric, text, integer, integer);

create function public.search_listings(
  p_search text default null,
  p_listing_type public.listing_type default null,
  p_category_id uuid default null,
  p_college_id text default null,
  p_condition public.listing_condition default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_sort text default 'newest',
  p_offset integer default 0,
  p_limit integer default 12
)
returns setof public.listings
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select l.* from public.listings l
  where l.archived_at is null
    and l.availability_status = 'available'
    and l.moderation_status = 'active'
    and (nullif(trim(p_search), '') is null or (l.title ilike ('%' || trim(p_search) || '%') or l.description ilike ('%' || trim(p_search) || '%')))
    and (p_listing_type is null or l.listing_type = p_listing_type)
    and (p_category_id is null or l.category_id = p_category_id)
    and (
      nullif(trim(p_college_id), '') is null
      or l.college_id::text = trim(p_college_id)
      or exists (
        select 1 from public.colleges c
        where c.id = l.college_id and c.name ilike ('%' || trim(p_college_id) || '%')
      )
    )
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
revoke all on function public.search_listings(text, public.listing_type, uuid, text, public.listing_condition, numeric, numeric, text, integer, integer) from public;
grant execute on function public.search_listings(text, public.listing_type, uuid, text, public.listing_condition, numeric, numeric, text, integer, integer) to anon, authenticated;

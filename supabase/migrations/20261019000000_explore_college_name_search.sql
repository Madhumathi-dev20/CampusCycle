drop function if exists public.search_listings(
  text,
  public.listing_type,
  uuid,
  uuid,
  public.listing_condition,
  numeric,
  numeric,
  text,
  integer,
  integer
);

drop function if exists public.search_listings(
  text,
  public.listing_type,
  uuid,
  text,
  public.listing_condition,
  numeric,
  numeric,
  text,
  integer,
  integer
);

create function public.search_listings(
  p_search text default null,
  p_listing_type public.listing_type default null,
  p_category_id uuid default null,
  p_college_name text default null,
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
      nullif(trim(p_college_name), '') is null
      or l.college_id::text = trim(p_college_name)
      or exists (
        select 1 from public.colleges c
        where c.id = l.college_id
          and strpos(lower(c.name), lower(trim(p_college_name))) > 0
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

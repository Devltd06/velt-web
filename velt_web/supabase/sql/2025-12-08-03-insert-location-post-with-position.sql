-- Migration: add server-side insert helper that assigns non-overlapping positions
-- This function will be used by the client uploader so new posts for the same
-- place get a deterministic spread and avoid exact overlap on the client canvas.

-- ensure schema has a denormalized author display name column
alter table if exists public.location_posts add column if not exists author_display_name text;

create or replace function public.insert_location_post(
  p_place text,
  p_country text,
  p_images text[] default '{}'::text[],
  p_avatar_url text default null,
  p_caption text default null,
  p_lat double precision default null,
  p_lng double precision default null
) returns public.location_posts language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  members_count integer;
  base_x double precision := coalesce(p_lat, 0.5);
  base_y double precision := coalesce(p_lng, 0.5);
  angle double precision;
  radius double precision;
  x double precision;
  y double precision;
  inserted_row public.location_posts%rowtype;
  _prof record;
  _display_name text := null;
  _avatar text := null;
begin
  if v_user_id is null then
    raise exception 'not-authenticated';
  end if;

  -- Count existing members for the same place (normalize by lower-case place)
  select count(*) into members_count
  from public.location_posts
  where lower(place) = lower(p_place) and country = p_country;

  -- choose an angle for the new post so posts spread around a circle
  angle := (members_count::double precision * 2.0 * pi()) / greatest(members_count + 1, 1);

  -- radius grows as group grows but prevents runaway values
  radius := least(0.06 + (members_count::double precision * 0.02), 0.28);

  -- compute final x/y inside normalized 0..1 (clamp to margins)
  x := least(greatest(base_x + cos(angle) * radius, 0.05), 0.95);
  y := least(greatest(base_y + sin(angle) * radius, 0.05), 0.95);

  -- attempt to fetch profile data server-side to denormalize display name & avatar
  select full_name, username, avatar_url into _prof from public.profiles where id = v_user_id limit 1;
  if found then
    _display_name := coalesce(_prof.full_name, _prof.username);
    _avatar := _prof.avatar_url;
  end if;

  insert into public.location_posts(user_id, place, country, images, avatar_url, author_display_name, caption, position, created_at)
    values (v_user_id, p_place, p_country, p_images, coalesce(p_avatar_url, _avatar), _display_name, p_caption, json_build_object('x', round(x::numeric, 6), 'y', round(y::numeric, 6)), timezone('utc', now()))
    returning * into inserted_row;

  return inserted_row;
end;
$$;


update public.location_posts lp
set author_display_name = coalesce(p.full_name, p.username),
    avatar_url = coalesce(lp.avatar_url, p.avatar_url)
from public.profiles p
where lp.user_id = p.id and (lp.author_display_name is null or lp.author_display_name = '');

with grouped as (
  select id, user_id, place, country, row_number() over (partition by lower(place), country order by created_at desc) - 1 as idx, count(*) over (partition by lower(place), country) - 1 as total
  from public.location_posts
  where coalesce(position::text, '') = '{}' or position is null
)
update public.location_posts p
set position = json_build_object('x', round( (0.5 + cos((g.idx::double precision / greatest(g.total + 1, 1)) * 2.0 * pi()) * least(0.06 + (g.total::double precision * 0.02), 0.28))::numeric, 6),
                                'y', round( (0.5 + sin((g.idx::double precision / greatest(g.total + 1, 1)) * 2.0 * pi()) * least(0.06 + (g.total::double precision * 0.02), 0.28))::numeric, 6))
from grouped g
where p.id = g.id;

-- Grant execute so authenticated clients can call the RPC
grant execute on function public.insert_location_post(text, text, text[], text, text, double precision, double precision) to authenticated;

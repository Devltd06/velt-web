-- Migration: Add video support to location_posts
-- This adds a videos column and media_type to distinguish between image and video posts

-- Add videos column (array of video URLs)
alter table if exists public.location_posts add column if not exists videos text[] default '{}';

-- Add media_type column to indicate primary media type
alter table if exists public.location_posts add column if not exists media_type text default 'image';

-- Update insert_location_post to accept videos
create or replace function public.insert_location_post(
  p_place text,
  p_country text,
  p_images text[] default '{}'::text[],
  p_videos text[] default '{}'::text[],
  p_media_type text default 'image',
  p_avatar_url text default null,
  p_caption text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_geo_latitude double precision default null,
  p_geo_longitude double precision default null
) returns public.location_posts language plpgsql
as $$
declare
  v_user_id uuid := auth.uid();
  members_count integer;
  base_x double precision;
  base_y double precision;
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

  -- Determine base normalized coordinates.
  if p_lat is not null then
    base_x := p_lat;
  elsif p_geo_longitude is not null then
    base_x := least(greatest((p_geo_longitude + 180.0) / 360.0, 0.0), 1.0);
  else
    base_x := 0.5;
  end if;

  if p_lng is not null then
    base_y := p_lng;
  elsif p_geo_latitude is not null then
    base_y := least(greatest((p_geo_latitude + 90.0) / 180.0, 0.0), 1.0);
  else
    base_y := 0.5;
  end if;

  -- Count existing members for the same place
  select count(*) into members_count
  from public.location_posts
  where lower(place) = lower(p_place) and country = p_country;

  angle := (members_count::double precision * 2.0 * pi()) / greatest(members_count + 1, 1);
  radius := least(0.06 + (members_count::double precision * 0.02), 0.28);

  x := least(greatest(base_x + cos(angle) * radius, 0.05), 0.95);
  y := least(greatest(base_y + sin(angle) * radius, 0.05), 0.95);

  select full_name, username, avatar_url into _prof from public.profiles where id = v_user_id limit 1;
  if found then
    _display_name := coalesce(_prof.full_name, _prof.username);
    _avatar := _prof.avatar_url;
  end if;

  insert into public.location_posts(user_id, place, country, images, videos, media_type, avatar_url, author_display_name, caption, position, latitude, longitude, created_at)
    values (
      v_user_id,
      p_place,
      p_country,
      p_images,
      p_videos,
      p_media_type,
      coalesce(p_avatar_url, _avatar),
      _display_name,
      p_caption,
      json_build_object('x', round(x::numeric, 6), 'y', round(y::numeric, 6)),
      p_geo_latitude,
      p_geo_longitude,
      timezone('utc', now())
    ) returning * into inserted_row;

  return inserted_row;
end;
$$;

-- Grant execute permission
grant execute on function public.insert_location_post(text, text, text[], text[], text, text, text, double precision, double precision, double precision, double precision) to authenticated;

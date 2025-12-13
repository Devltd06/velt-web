-- Migration: Create toggle_location_post_star RPC function
-- This function handles starring/unstarring location posts and maintains the star count

-- Create star count materialized view/table if not exists
create table if not exists public.location_post_star_counts (
  location_post_id uuid primary key references public.location_posts(id) on delete cascade,
  star_count integer not null default 0
);

-- Create the toggle function
create or replace function public.toggle_location_post_star(
  p_post_id uuid,
  p_user_id uuid
) returns integer language plpgsql security definer
as $$
declare
  v_exists boolean;
  v_new_count integer;
begin
  -- Check if the star already exists
  select exists(
    select 1 from public.location_post_stars 
    where location_post_id = p_post_id and user_id = p_user_id
  ) into v_exists;
  
  if v_exists then
    -- Remove the star
    delete from public.location_post_stars 
    where location_post_id = p_post_id and user_id = p_user_id;
  else
    -- Add the star
    insert into public.location_post_stars (location_post_id, user_id)
    values (p_post_id, p_user_id)
    on conflict (location_post_id, user_id) do nothing;
  end if;
  
  -- Update the count in the counts table
  insert into public.location_post_star_counts (location_post_id, star_count)
  values (p_post_id, (
    select count(*) from public.location_post_stars where location_post_id = p_post_id
  ))
  on conflict (location_post_id) do update set star_count = excluded.star_count;
  
  -- Return the new count
  select star_count into v_new_count 
  from public.location_post_star_counts 
  where location_post_id = p_post_id;
  
  return coalesce(v_new_count, 0);
end;
$$;

-- Create the location_post_stars table if not exists
create table if not exists public.location_post_stars (
  id uuid primary key default gen_random_uuid(),
  location_post_id uuid not null references public.location_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(location_post_id, user_id)
);

-- Create indexes
create index if not exists idx_location_post_stars_post on public.location_post_stars(location_post_id);
create index if not exists idx_location_post_stars_user on public.location_post_stars(user_id);

-- Enable RLS
alter table public.location_post_stars enable row level security;
alter table public.location_post_star_counts enable row level security;

-- RLS policies for stars
create policy "Anyone can view location post stars"
  on public.location_post_stars for select
  using (true);

create policy "Authenticated users can insert stars"
  on public.location_post_stars for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete their own stars"
  on public.location_post_stars for delete
  to authenticated
  using (auth.uid() = user_id);

-- RLS for star counts (read only for clients)
create policy "Anyone can view star counts"
  on public.location_post_star_counts for select
  using (true);

-- Grant permissions
grant select on public.location_post_stars to anon, authenticated;
grant insert, delete on public.location_post_stars to authenticated;
grant select on public.location_post_star_counts to anon, authenticated;
grant execute on function public.toggle_location_post_star(uuid, uuid) to authenticated;

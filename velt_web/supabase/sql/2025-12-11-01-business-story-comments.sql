-- Migration: Create business_story_comments table for commenting on business stories
-- This table mirrors the structure of story_comments but references business_stories

-- Create the business_story_comments table if it doesn't exist
create table if not exists public.business_story_comments (
  id uuid primary key default gen_random_uuid(),
  business_story_id uuid not null references public.business_stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  parent_id uuid references public.business_story_comments(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz
);

-- Create indexes for performance
create index if not exists idx_business_story_comments_story on public.business_story_comments(business_story_id);
create index if not exists idx_business_story_comments_user on public.business_story_comments(user_id);
create index if not exists idx_business_story_comments_parent on public.business_story_comments(parent_id);
create index if not exists idx_business_story_comments_created on public.business_story_comments(created_at desc);

-- Enable Row Level Security
alter table public.business_story_comments enable row level security;

-- Policy: Anyone can read comments
create policy "Anyone can view business story comments"
  on public.business_story_comments for select
  using (true);

-- Policy: Authenticated users can insert their own comments
create policy "Authenticated users can insert comments"
  on public.business_story_comments for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Users can update their own comments
create policy "Users can update their own comments"
  on public.business_story_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own comments
create policy "Users can delete their own comments"
  on public.business_story_comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- Grant permissions
grant select on public.business_story_comments to anon, authenticated;
grant insert, update, delete on public.business_story_comments to authenticated;

-- Migration: Create business_story_comment_likes table for liking business story comments
-- This table mirrors the structure of story_comment_likes but references business_story_comments

-- Create the business_story_comment_likes table if it doesn't exist
create table if not exists public.business_story_comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.business_story_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  
  -- Ensure a user can only like a comment once
  unique(comment_id, user_id)
);

-- Create indexes for performance
create index if not exists idx_business_story_comment_likes_comment on public.business_story_comment_likes(comment_id);
create index if not exists idx_business_story_comment_likes_user on public.business_story_comment_likes(user_id);

-- Enable Row Level Security
alter table public.business_story_comment_likes enable row level security;

-- Policy: Anyone can view likes
create policy "Anyone can view business story comment likes"
  on public.business_story_comment_likes for select
  using (true);

-- Policy: Authenticated users can insert their own likes
create policy "Authenticated users can like comments"
  on public.business_story_comment_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Policy: Users can delete their own likes (unlike)
create policy "Users can unlike their own likes"
  on public.business_story_comment_likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- Grant permissions
grant select on public.business_story_comment_likes to anon, authenticated;
grant insert, delete on public.business_story_comment_likes to authenticated;

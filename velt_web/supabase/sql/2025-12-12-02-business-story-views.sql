-- Migration: Create business_story_views table for tracking views on business stories
-- Date: 2025-12-12

-- Create the business_story_views table
CREATE TABLE IF NOT EXISTS public.business_story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_story_id UUID NOT NULL REFERENCES public.business_stories(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure unique view per user per story
  CONSTRAINT business_story_views_unique UNIQUE (business_story_id, viewer_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_business_story_views_story_id ON public.business_story_views(business_story_id);
CREATE INDEX IF NOT EXISTS idx_business_story_views_viewer_id ON public.business_story_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_business_story_views_viewed_at ON public.business_story_views(viewed_at DESC);

-- Enable RLS
ALTER TABLE public.business_story_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Anyone can view view counts (for public stories)
CREATE POLICY "Anyone can view business story view counts"
  ON public.business_story_views
  FOR SELECT
  USING (true);

-- Users can insert their own views
CREATE POLICY "Users can mark business stories as viewed"
  ON public.business_story_views
  FOR INSERT
  WITH CHECK (auth.uid() = viewer_id);

-- Users can update their own views (for upsert)
CREATE POLICY "Users can update their own business story views"
  ON public.business_story_views
  FOR UPDATE
  USING (auth.uid() = viewer_id)
  WITH CHECK (auth.uid() = viewer_id);

-- Grant permissions
GRANT SELECT ON public.business_story_views TO authenticated;
GRANT INSERT ON public.business_story_views TO authenticated;
GRANT UPDATE ON public.business_story_views TO authenticated;
GRANT SELECT ON public.business_story_views TO anon;

-- Add comment for documentation
COMMENT ON TABLE public.business_story_views IS 'Tracks views on business stories for analytics and view counts';

-- Add a nullable boolean column `is_hd` to stories and business_stories
-- This allows stories to persist whether the media is HD (true) or compressed (false)
-- Run with the Supabase CLI or psql against your database:
--   supabase db query < supabase/sql/001_add_is_hd_to_stories.sql
-- or run inside psql:
--   ALTER TABLE IF EXISTS public.stories ADD COLUMN IF NOT EXISTS is_hd boolean;
--   ALTER TABLE IF EXISTS public.business_stories ADD COLUMN IF NOT EXISTS is_hd boolean;

BEGIN;

ALTER TABLE IF EXISTS public.stories ADD COLUMN IF NOT EXISTS is_hd boolean;
ALTER TABLE IF EXISTS public.business_stories ADD COLUMN IF NOT EXISTS is_hd boolean;

COMMIT;

-- Backfill note: consider running an audit/backfill if you want historical rows set to true
-- e.g. to mark existing stories as HD you can run:
-- UPDATE public.stories SET is_hd = true WHERE is_hd IS NULL;
